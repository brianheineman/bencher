use std::sync::Arc;

#[cfg(feature = "plus")]
use bencher_json::system::config::{JsonLitestream, JsonPlus};
use bencher_json::{
    system::config::{
        IfExists, JsonConsole, JsonDatabase, JsonLogging, JsonSecurity, JsonServer, JsonSmtp,
        JsonTls, LogLevel, ServerLog,
    },
    JsonConfig,
};
use bencher_rbac::init_rbac;
use bencher_token::TokenKey;
use diesel::{connection::SimpleConnection, Connection};
use diesel_migrations::{embed_migrations, EmbeddedMigrations, MigrationHarness};
use dropshot::{
    ApiDescription, ConfigDropshot, ConfigLogging, ConfigLoggingIfExists, ConfigLoggingLevel,
    ConfigTls, HttpServer,
};
use slog::{debug, error, info, Logger};
use tokio::sync::mpsc::Sender;

#[cfg(feature = "plus")]
use crate::model::server::QueryServer;
use crate::{
    context::{ApiContext, Database, DbConnection},
    endpoints::Api,
};

use super::Config;
#[cfg(feature = "plus")]
use super::{plus::Plus, DEFAULT_BUSY_TIMEOUT};

const DATABASE_URL: &str = "DATABASE_URL";
const MIGRATIONS: EmbeddedMigrations = embed_migrations!("./migrations");

pub struct ConfigTx {
    pub config: Config,
    pub restart_tx: Sender<()>,
}

#[derive(Debug, thiserror::Error)]
pub enum ConfigTxError {
    #[error("Failed to create server logger: {0}")]
    CreateLogger(std::io::Error),
    #[error("Failed to run database migrations: {0}")]
    Migrations(Box<dyn std::error::Error + Send + Sync>),
    #[error("Failed to run database pragma: {0}")]
    Pragma(diesel::result::Error),
    #[error("Failed to parse role based access control (RBAC) rules: {0}")]
    Polar(oso::OsoError),
    #[error("Invalid endpoint URL: {0}")]
    Endpoint(bencher_json::ValidError),
    #[error("Failed to connect to database ({0}): {1}")]
    DatabaseConnection(String, diesel::ConnectionError),
    #[error("Failed to parse data store: {0}")]
    DataStore(crate::context::DataStoreError),
    #[error("Failed to register endpoint: {0}")]
    Register(dropshot::ApiDescriptionRegisterError),
    #[error("Failed to create server: {0}")]
    CreateServer(Box<dyn std::error::Error + Send + Sync>),

    #[cfg(feature = "plus")]
    #[error("{0}")]
    Plus(super::plus::PlusError),
    #[cfg(feature = "plus")]
    #[error("Failed to get server ID: {0}")]
    ServerId(dropshot::HttpError),
}

impl ConfigTx {
    pub async fn into_server(self) -> Result<HttpServer<ApiContext>, ConfigTxError> {
        let log = into_log(self.config.0.logging.clone())?;
        self.into_inner(&log).await.map_err(|e| {
            error!(&log, "{e}");
            e
        })
    }

    async fn into_inner(self, log: &Logger) -> Result<HttpServer<ApiContext>, ConfigTxError> {
        let ConfigTx { config, restart_tx } = self;

        let Config(JsonConfig {
            console,
            security,
            mut server,
            database,
            smtp,
            logging: _,
            #[cfg(feature = "plus")]
            plus,
        }) = config;

        debug!(log, "Creating internal configuration");
        let context = into_context(
            log,
            console,
            security,
            smtp,
            database,
            restart_tx,
            #[cfg(feature = "plus")]
            plus,
        )?;
        debug!(log, "Configuring TLS");
        let tls = server.tls.take().map(|json_tls| match json_tls {
            JsonTls::AsFile {
                cert_file,
                key_file,
            } => ConfigTls::AsFile {
                cert_file,
                key_file,
            },
            JsonTls::AsBytes { certs, key } => ConfigTls::AsBytes { certs, key },
        });
        let config_dropshot = into_config_dropshot(server);

        #[cfg(feature = "plus")]
        {
            let conn = context.database.connection.clone();
            let query_server = QueryServer::get_or_create(&mut *conn.lock().await)
                .map_err(ConfigTxError::ServerId)?;
            info!(log, "Bencher API Server ID: {}", query_server.uuid);

            // Bencher Cloud does not need to send stats to itself,
            // so we just include the Messenger directly.
            // Bencher Self-Hosted needs the Licensor in order to check for a valid license if stats are disabled.
            let (licensor, messenger) = if context.is_bencher_cloud {
                (None, Some(context.messenger.clone()))
            } else {
                (Some(context.licensor.clone()), None)
            };
            query_server.spawn_stats(log.clone(), conn, context.stats, licensor, messenger);
        }

        let mut api = ApiDescription::new();
        debug!(log, "Registering server APIs");
        Api::register(
            &mut api,
            true,
            #[cfg(feature = "plus")]
            context.is_bencher_cloud,
        )
        .map_err(ConfigTxError::Register)?;

        Ok(
            dropshot::HttpServerStarter::new_with_tls(&config_dropshot, api, context, log, tls)
                .map_err(ConfigTxError::CreateServer)?
                .start(),
        )
    }
}

fn into_context(
    log: &Logger,
    console: JsonConsole,
    security: JsonSecurity,
    smtp: Option<JsonSmtp>,
    json_database: JsonDatabase,
    restart_tx: Sender<()>,
    #[cfg(feature = "plus")] plus: Option<JsonPlus>,
) -> Result<ApiContext, ConfigTxError> {
    let console_url: url::Url = console.url.try_into().map_err(ConfigTxError::Endpoint)?;
    let database_path = json_database.file.to_string_lossy();
    diesel_database_url(log, &database_path);

    info!(&log, "Connecting to database: {database_path}");
    let mut database_connection = DbConnection::establish(&database_path)
        .map_err(|e| ConfigTxError::DatabaseConnection(database_path.to_string(), e))?;

    #[cfg(feature = "plus")]
    if let Some(litestream) = plus.as_ref().and_then(|plus| plus.litestream.as_ref()) {
        info!(&log, "Configuring Litestream");
        run_litestream(&mut database_connection, litestream)?;
    }

    info!(&log, "Running database migrations");
    run_migrations(&mut database_connection)?;

    let data_store = if let Some(data_store) = json_database.data_store {
        Some(data_store.try_into().map_err(ConfigTxError::DataStore)?)
    } else {
        None
    };

    info!(&log, "Loading secret key");
    let token_key = TokenKey::new(
        security.issuer.unwrap_or_else(|| console_url.to_string()),
        &security.secret_key,
    );

    info!(&log, "Configuring Bencher Plus");
    #[cfg(feature = "plus")]
    let Plus {
        github,
        stats,
        biller,
        licensor,
        indexer,
    } = Plus::new(&console_url, plus).map_err(ConfigTxError::Plus)?;

    #[cfg(feature = "plus")]
    let is_bencher_cloud = bencher_json::is_bencher_cloud(&console_url) && biller.is_some();

    debug!(&log, "Creating API context");
    Ok(ApiContext {
        console_url,
        token_key,
        rbac: init_rbac().map_err(ConfigTxError::Polar)?.into(),
        messenger: smtp.into(),
        database: Database {
            path: json_database.file,
            connection: Arc::new(tokio::sync::Mutex::new(database_connection)),
            data_store,
        },
        restart_tx,
        #[cfg(feature = "plus")]
        github,
        #[cfg(feature = "plus")]
        stats,
        #[cfg(feature = "plus")]
        biller,
        #[cfg(feature = "plus")]
        licensor,
        #[cfg(feature = "plus")]
        indexer,
        #[cfg(feature = "plus")]
        is_bencher_cloud,
    })
}

// Set the diesel `DATABASE_URL` env var to the database path
fn diesel_database_url(log: &Logger, database_path: &str) {
    if let Ok(database_url) = std::env::var(DATABASE_URL) {
        if database_url == database_path {
            return;
        }
        debug!(
            log,
            "\"{DATABASE_URL}\" ({database_url}) must be the same value as {database_path}"
        );
    } else {
        debug!(log, "Failed to find \"{DATABASE_URL}\"");
    }
    debug!(log, "Setting \"{DATABASE_URL}\" to {database_path}");
    std::env::set_var(DATABASE_URL, database_path);
}

fn run_migrations(database: &mut DbConnection) -> Result<(), ConfigTxError> {
    // It is not possible to enable or disable foreign key constraints in the middle of a multi-statement transaction
    // (when SQLite is not in autocommit mode).
    // Attempting to do so does not return an error; it simply has no effect.
    // https://www.sqlite.org/foreignkeys.html#fk_enable
    // Therefore, we must run all migrations with foreign key constraints disabled.
    // Still use `PRAGMA foreign_keys = OFF` in the migration scripts to disable foreign key constraints when using the CLI.
    database
        .batch_execute("PRAGMA foreign_keys = OFF")
        .map_err(ConfigTxError::Pragma)?;
    database
        .run_pending_migrations(MIGRATIONS)
        .map(|_| ())
        .map_err(ConfigTxError::Migrations)?;
    database
        .batch_execute("PRAGMA foreign_keys = ON")
        .map_err(ConfigTxError::Pragma)?;

    Ok(())
}

#[cfg(feature = "plus")]
fn run_litestream(
    database: &mut DbConnection,
    litestream: &JsonLitestream,
) -> Result<(), ConfigTxError> {
    // Enable WAL mode
    // https://litestream.io/tips/#wal-journal-mode
    // https://sqlite.org/wal.html
    database
        .batch_execute("PRAGMA journal_mode = WAL")
        .map_err(ConfigTxError::Pragma)?;
    // Disable auto-checkpoints
    // https://litestream.io/tips/#disable-autocheckpoints-for-high-write-load-servers
    // https://sqlite.org/wal.html#automatic_checkpoint
    database
        .batch_execute("PRAGMA wal_autocheckpoint = 0")
        .map_err(ConfigTxError::Pragma)?;
    // Enable busy timeout
    // https://litestream.io/tips/#busy-timeout
    // https://www.sqlite.org/pragma.html#pragma_busy_timeout
    let busy_timeout = format!(
        "PRAGMA busy_timeout = {}",
        litestream.busy_timeout.unwrap_or(DEFAULT_BUSY_TIMEOUT)
    );
    database
        .batch_execute(&busy_timeout)
        .map_err(ConfigTxError::Pragma)?;
    // Relax synchronous mode because we are using WAL mode
    // https://litestream.io/tips/#synchronous-pragma
    // https://www.sqlite.org/pragma.html#pragma_synchronous
    database
        .batch_execute("PRAGMA synchronous = NORMAL")
        .map_err(ConfigTxError::Pragma)?;

    Ok(())
}

#[allow(clippy::needless_pass_by_value)]
fn into_config_dropshot(server: JsonServer) -> ConfigDropshot {
    let JsonServer {
        bind_address,
        request_body_max_bytes,
        tls: _,
    } = server;
    ConfigDropshot {
        bind_address,
        default_request_body_max_bytes: request_body_max_bytes,
        default_handler_task_mode: dropshot::HandlerTaskMode::Detached,
        log_headers: Vec::new(),
    }
}

fn into_log(logging: JsonLogging) -> Result<Logger, ConfigTxError> {
    let JsonLogging { name, log } = logging;
    match log {
        ServerLog::StderrTerminal { level } => ConfigLogging::StderrTerminal {
            level: into_level(&level),
        },
        ServerLog::File {
            level,
            path,
            if_exists,
        } => ConfigLogging::File {
            level: into_level(&level),
            path: path.into(),
            if_exists: into_if_exists(&if_exists),
        },
    }
    .to_logger(name)
    .map_err(ConfigTxError::CreateLogger)
}

fn into_level(log_level: &LogLevel) -> ConfigLoggingLevel {
    match log_level {
        LogLevel::Trace => ConfigLoggingLevel::Trace,
        LogLevel::Debug => ConfigLoggingLevel::Debug,
        LogLevel::Info => ConfigLoggingLevel::Info,
        LogLevel::Warn => ConfigLoggingLevel::Warn,
        LogLevel::Error => ConfigLoggingLevel::Error,
        LogLevel::Critical => ConfigLoggingLevel::Critical,
    }
}

fn into_if_exists(if_exists: &IfExists) -> ConfigLoggingIfExists {
    match if_exists {
        IfExists::Fail => ConfigLoggingIfExists::Fail,
        IfExists::Truncate => ConfigLoggingIfExists::Truncate,
        IfExists::Append => ConfigLoggingIfExists::Append,
    }
}
