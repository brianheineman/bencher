use crate::{bencher::sub::SubCmd, parser::docker::CliLogs, CliError};
use bollard::{
    container::{LogOutput, LogsOptions},
    Docker,
};
use futures_util::stream::StreamExt;

use crate::cli_println;

use super::{DockerError, BENCHER_API_CONTAINER, BENCHER_UI_CONTAINER};

#[derive(Debug, Clone)]
pub struct Logs {}

impl From<CliLogs> for Logs {
    fn from(logs: CliLogs) -> Self {
        let CliLogs {} = logs;
        Self {}
    }
}

impl SubCmd for Logs {
    async fn exec(&self) -> Result<(), CliError> {
        let docker = Docker::connect_with_local_defaults().map_err(DockerError::Daemon)?;

        let mut api_logs = container_logs(&docker, BENCHER_API_CONTAINER);

        loop {
            tokio::select! {
                _ = tokio::signal::ctrl_c() => {
                    cli_println!("🐰 Bencher Self-Hosted logs closed.");
                    break;
                }
                Some(log) = api_logs.next() => {
                    if let Ok(log) = log {
                        cli_println!("{log}");
                    } else {
                        break;
                    }
                },
            }
        }

        Ok(())
    }
}

fn container_logs(
    docker: &Docker,
    container: &str,
) -> impl futures_util::Stream<Item = Result<LogOutput, bollard::errors::Error>> {
    let options = Some(LogsOptions {
        follow: true,
        stdout: true,
        stderr: true,
        tail: "all".to_owned(),
        ..Default::default()
    });
    docker.logs(container, options)
}
