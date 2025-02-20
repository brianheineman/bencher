#![allow(clippy::absolute_paths)]

use std::env;

use bencher_json::{Jwt, BENCHER_API_URL};
use reqwest::ClientBuilder;
use serde::{de::DeserializeOwned, Serialize};
use tokio::time::{sleep, Duration};

use crate::{SSL_CERT_FILE, SSL_CLIENT_CERT};

const DEFAULT_TIMEOUT: Duration = Duration::from_secs(15);
const DEFAULT_ATTEMPTS: usize = 10;
const DEFAULT_RETRY_AFTER: u64 = 1;

#[allow(clippy::struct_excessive_bools)]
/// A client for the Bencher API
#[derive(Debug, Clone)]
pub struct BencherClient {
    pub host: url::Url,
    pub token: Option<Jwt>,
    pub insecure_host: bool,
    pub native_tls: bool,
    pub timeout: Duration,
    pub attempts: usize,
    pub retry_after: u64,
    pub strict: bool,
    pub log: bool,
}

#[allow(clippy::absolute_paths)]
#[derive(thiserror::Error, Debug)]
pub enum ClientError {
    #[error("Failed to build. Missing `host` field.")]
    NoHost,

    #[error("Failed to parse Authorization header: {0}")]
    HeaderValue(reqwest::header::InvalidHeaderValue),
    #[error("Failed to build API client: {0}")]
    BuildClient(reqwest::Error),

    #[error("Failed to deserialize response JSON: {0}")]
    DeserializeResponse(Box<dyn std::error::Error + Send + Sync>),
    #[error("Failed to serialize response JSON: {0}")]
    SerializeResponse(serde_json::Error),

    #[error("Invalid request. The request did not conform to API requirements: {0}")]
    InvalidRequest(String),
    #[error("Error processing the request pre-hook: {0}")]
    PreHookError(String),
    #[error("Error processing the request post-hook: {0}")]
    PostHookError(String),
    #[error("Error processing request:\n{0}")]
    ErrorResponse(Box<ErrorResponse>),
    #[error("Error upgrading request: {0}")]
    InvalidUpgrade(reqwest::Error),
    #[error("Invalid response body bytes: {0}")]
    ResponseBodyError(reqwest::Error),
    #[error("Invalid response payload ({len}): {1}", len = _0.len())]
    InvalidResponsePayloadStrict(bytes::Bytes, serde_json::Error),
    #[error("Invalid response payload: {0}")]
    InvalidResponsePayload(serde_json::Error),
    #[error("Request succeeded with an unexpected response: {0:?}")]
    UnexpectedResponseOkStrict(reqwest::Response),
    #[error("Request succeeded with an unexpected response body: {0}")]
    UnexpectedResponseOk(reqwest::Error),
    #[error("Request failed with an unexpected response: {0:?}")]
    UnexpectedResponseErr(reqwest::Response),

    #[error("Failed to send after {0} attempts")]
    SendTimeout(usize),
}

impl BencherClient {
    /// Create a new `BencherClientBuilder`
    pub fn builder() -> BencherClientBuilder {
        BencherClientBuilder::default()
    }

    /// Turn the `BencherClient` into a `BencherClientBuilder`
    pub fn into_builder(self) -> BencherClientBuilder {
        BencherClientBuilder {
            host: Some(self.host),
            token: self.token,
            insecure_host: Some(self.insecure_host),
            native_tls: Some(self.native_tls),
            timeout: Some(self.timeout),
            attempts: Some(self.attempts),
            retry_after: Some(self.retry_after),
            strict: Some(self.strict),
            log: Some(self.log),
        }
    }

    /// Send a request to the Bencher API
    ///
    /// Returns a generic JSON value as the response.
    /// To get a typed response, use `send_with` instead.
    ///
    /// # Parameters
    ///
    /// - `sender`: A function that takes a `codegen::Client` and returns a `Future` that resolves
    ///   to a `Result` containing a `serde_json::Value` or an `Error`
    ///
    /// # Returns
    ///
    /// A `Result` containing the response JSON value or an `Error`
    pub async fn send<F, R, T, E>(&self, sender: F) -> Result<serde_json::Value, ClientError>
    where
        F: Fn(crate::codegen::Client) -> R,
        R: std::future::Future<
            Output = Result<
                progenitor_client::ResponseValue<T>,
                crate::codegen::Error<crate::codegen::types::Error>,
            >,
        >,
        T: Serialize,
        E: std::error::Error + Send + Sync + 'static,
        crate::JsonValue: TryFrom<T, Error = E>,
    {
        self.send_with(sender)
            .await
            .map(|json: crate::JsonValue| json.into())
    }

    /// Send a request to the Bencher API
    ///
    /// # Parameters
    ///
    /// - `sender`: A function that takes a `codegen::Client` and returns a `Future` that resolves
    ///   to a `Result` containing a `ResponseValue` or an `Error`
    ///
    /// # Returns
    ///
    /// A `Result` containing the response JSON or an `Error`
    #[allow(clippy::too_many_lines)]
    pub async fn send_with<F, R, T, Json, E>(&self, sender: F) -> Result<Json, ClientError>
    where
        F: Fn(crate::codegen::Client) -> R,
        R: std::future::Future<
            Output = Result<
                progenitor_client::ResponseValue<T>,
                crate::codegen::Error<crate::codegen::types::Error>,
            >,
        >,
        T: Serialize,
        Json: DeserializeOwned + Serialize + TryFrom<T, Error = E>,
        E: std::error::Error + Send + Sync + 'static,
    {
        let reqwest_client = self
            .client_builder()?
            .build()
            .map_err(ClientError::BuildClient)?;
        let client = crate::codegen::Client::new_with_client(self.host.as_ref(), reqwest_client);

        let attempts = self.attempts;
        let max_attempts = attempts.checked_sub(1).unwrap_or_default();
        let mut retry_after = self.retry_after;

        for attempt in 0..attempts {
            match sender(client.clone()).await {
                Ok(response_value) => {
                    let response = response_value.into_inner();
                    let json_response = Json::try_from(response)
                        .map_err(Into::into)
                        .map_err(ClientError::DeserializeResponse)?;
                    self.log_json(&json_response)?;
                    return Ok(json_response);
                },
                #[allow(clippy::print_stderr)]
                Err(crate::codegen::Error::CommunicationError(e)) => {
                    if self.log {
                        eprintln!("\nSend attempt #{}/{attempts}: {e}", attempt + 1);
                    }
                    if attempt != max_attempts {
                        if self.log {
                            eprintln!("Will retry after {retry_after} second(s).");
                        }
                        sleep(Duration::from_secs(retry_after)).await;
                        retry_after *= 2;
                    }
                },
                Err(crate::codegen::Error::InvalidRequest(e)) => {
                    return Err(ClientError::InvalidRequest(e))
                },
                Err(crate::codegen::Error::PreHookError(e)) => {
                    return Err(ClientError::PreHookError(e))
                },
                Err(crate::codegen::Error::PostHookError(e)) => {
                    return Err(ClientError::PostHookError(e))
                },
                Err(crate::codegen::Error::ErrorResponse(e)) => {
                    let status = e.status();
                    let headers = e.headers().clone();
                    let http_error = e.into_inner();
                    return Err(ClientError::ErrorResponse(Box::new(ErrorResponse {
                        status,
                        headers,
                        request_id: http_error.request_id,
                        error_code: http_error.error_code,
                        message: http_error.message,
                    })));
                },
                Err(crate::codegen::Error::InvalidUpgrade(e)) => {
                    return Err(ClientError::InvalidUpgrade(e))
                },
                Err(crate::codegen::Error::ResponseBodyError(e)) => {
                    return Err(ClientError::ResponseBodyError(e))
                },
                Err(crate::codegen::Error::InvalidResponsePayload(bytes, e)) => {
                    return if self.strict {
                        Err(ClientError::InvalidResponsePayloadStrict(bytes, e))
                    } else {
                        match serde_json::from_slice(&bytes) {
                            Ok(json_response) => {
                                self.log_json(&json_response)?;
                                Ok(json_response)
                            },
                            Err(e) => Err(ClientError::InvalidResponsePayload(e)),
                        }
                    }
                },
                Err(crate::codegen::Error::UnexpectedResponse(response)) => {
                    return if response.status().is_success() {
                        if self.strict {
                            Err(ClientError::UnexpectedResponseOkStrict(response))
                        } else {
                            match response.json().await {
                                Ok(json_response) => {
                                    self.log_json(&json_response)?;
                                    Ok(json_response)
                                },
                                Err(e) => Err(ClientError::UnexpectedResponseOk(e)),
                            }
                        }
                    } else {
                        Err(ClientError::UnexpectedResponseErr(response))
                    }
                },
            }
        }

        Err(ClientError::SendTimeout(attempts))
    }

    fn client_builder(&self) -> Result<ClientBuilder, ClientError> {
        let mut client_builder = ClientBuilder::new().connect_timeout(self.timeout);

        if let Some(token) = &self.token {
            let mut headers = reqwest::header::HeaderMap::new();
            let bearer_token = reqwest::header::HeaderValue::from_str(&format!("Bearer {token}"))
                .map_err(ClientError::HeaderValue)?;
            headers.insert("Authorization", bearer_token);
            client_builder = client_builder.default_headers(headers);
        }

        let client_builder = self.client_builder_tls(client_builder);

        Ok(client_builder)
    }

    // https://github.com/astral-sh/uv/blob/591f38c25e577d29bb4fd0dde7cdb614f3129bfc/crates/uv-client/src/base_client.rs#L264
    fn client_builder_tls(&self, mut client_builder: ClientBuilder) -> ClientBuilder {
        if self.insecure_host {
            client_builder = client_builder.danger_accept_invalid_certs(true);
        }

        client_builder = client_builder.tls_built_in_root_certs(false);
        client_builder = if self.native_tls || self.cert_file_exists() {
            client_builder.tls_built_in_native_certs(true)
        } else {
            client_builder.tls_built_in_webpki_certs(true)
        };

        // Configure mTLS.
        if let Some(ssl_client_cert) = env::var_os(SSL_CLIENT_CERT) {
            match crate::tls::read_identity(&ssl_client_cert) {
                Ok(identity) => client_builder = client_builder.identity(identity),
                Err(err) => {
                    self.log_str(&format!("Ignoring invalid `SSL_CLIENT_CERT`: {err}"));
                },
            }
        }

        client_builder
    }

    // https://github.com/astral-sh/uv/blob/591f38c25e577d29bb4fd0dde7cdb614f3129bfc/crates/uv-client/src/base_client.rs#L186
    fn cert_file_exists(&self) -> bool {
        use std::path::Path;
        env::var_os(SSL_CERT_FILE).is_some_and(|path| {
            let path_exists = Path::new(&path).exists();
            if !path_exists {
                self.log_str(&format!(
                    "Ignoring invalid `SSL_CERT_FILE`. File does not exist: {path:?}"
                ));
            }
            path_exists
        })
    }

    fn log_json<T>(&self, response: &T) -> Result<(), ClientError>
    where
        T: Serialize,
    {
        let json =
            serde_json::to_string_pretty(&response).map_err(ClientError::SerializeResponse)?;
        self.log_str(&json);
        Ok(())
    }

    fn log_str(&self, err: &str) {
        #[allow(clippy::print_stdout)]
        if self.log {
            println!("{err}");
        }
    }
}

#[derive(Debug)]
pub struct ErrorResponse {
    pub status: reqwest::StatusCode,
    pub headers: reqwest::header::HeaderMap,
    pub request_id: String,
    pub error_code: Option<String>,
    pub message: String,
}

impl std::fmt::Display for ErrorResponse {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        writeln!(f, "Status: {}", self.status)?;
        #[allow(clippy::use_debug)]
        writeln!(f, "Headers: {:?}", self.headers)?;
        writeln!(f, "Request ID: {}", self.request_id)?;
        if let Some(error_code) = &self.error_code {
            writeln!(f, "Error Code: {error_code}")?;
        }
        writeln!(f, "Message: {}", self.message)?;
        Ok(())
    }
}

/// A builder for `BencherClient`
#[derive(Debug, Clone, Default)]
pub struct BencherClientBuilder {
    host: Option<url::Url>,
    token: Option<Jwt>,
    insecure_host: Option<bool>,
    native_tls: Option<bool>,
    timeout: Option<Duration>,
    attempts: Option<usize>,
    retry_after: Option<u64>,
    strict: Option<bool>,
    log: Option<bool>,
}

impl BencherClientBuilder {
    #[must_use]
    /// New `BencherClientBuilder`
    pub fn new() -> Self {
        Self::default()
    }

    #[must_use]
    /// Set the host URL
    pub fn host(mut self, host: url::Url) -> Self {
        self.host = Some(host);
        self
    }

    #[must_use]
    /// Set the JWT token
    pub fn token(mut self, token: Jwt) -> Self {
        self.token = Some(token);
        self
    }

    #[must_use]
    /// Set allow insecure host
    pub fn insecure_host(mut self, insecure_host: bool) -> Self {
        self.insecure_host = Some(insecure_host);
        self
    }

    #[must_use]
    /// Set the JWT token
    pub fn native_tls(mut self, native_tls: bool) -> Self {
        self.native_tls = Some(native_tls);
        self
    }

    #[must_use]
    /// Set the timeout for the request
    pub fn timeout(mut self, timeout: Duration) -> Self {
        self.timeout = Some(timeout);
        self
    }

    #[must_use]
    /// Set the number of attempts to make before giving up
    pub fn attempts(mut self, attempts: usize) -> Self {
        self.attempts = Some(attempts);
        self
    }

    #[must_use]
    /// Set the number of initial seconds to wait between attempts (exponential backoff)
    pub fn retry_after(mut self, retry_after: u64) -> Self {
        self.retry_after = Some(retry_after);
        self
    }

    #[must_use]
    /// Do not retry parsing the response JSON if it fails to deserialize the original client type
    pub fn strict(mut self, log: bool) -> Self {
        self.log = Some(log);
        self
    }

    #[must_use]
    /// Set whether to log the response JSON to stdout
    pub fn log(mut self, log: bool) -> Self {
        self.log = Some(log);
        self
    }

    /// Build the `BencherClient`
    ///
    /// Default values:
    /// - `host`: `https://api.bencher.dev`
    /// - `attempts`: `10`
    /// - `retry_after`: `1`
    pub fn build(self) -> BencherClient {
        let Self {
            host,
            token,
            insecure_host,
            native_tls,
            timeout,
            attempts,
            retry_after,
            strict,
            log,
        } = self;
        BencherClient {
            host: host.unwrap_or_else(|| BENCHER_API_URL.clone()),
            token,
            insecure_host: insecure_host.unwrap_or_default(),
            native_tls: native_tls.unwrap_or_default(),
            timeout: timeout.unwrap_or(DEFAULT_TIMEOUT),
            attempts: attempts.unwrap_or(DEFAULT_ATTEMPTS),
            retry_after: retry_after.unwrap_or(DEFAULT_RETRY_AFTER),
            strict: strict.unwrap_or_default(),
            log: log.unwrap_or_default(),
        }
    }
}
