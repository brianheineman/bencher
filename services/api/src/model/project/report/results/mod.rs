use std::collections::HashMap;

use bencher_adapter::{
    results::adapter_metrics::AdapterMetrics, AdapterResults, AdapterResultsArray,
    Settings as AdapterSettings,
};
use bencher_json::{
    project::report::{Adapter, Iteration, JsonReportSettings},
    BenchmarkName, MeasureNameId,
};
use diesel::RunQueryDsl;
use dropshot::HttpError;
use slog::Logger;

use crate::{
    conn_lock,
    context::ApiContext,
    error::{bad_request_error, issue_error, resource_conflict_err},
    model::project::{
        benchmark::{BenchmarkId, QueryBenchmark},
        branch::{head::HeadId, BranchId},
        measure::{MeasureId, QueryMeasure},
        metric::{InsertMetric, QueryMetric},
        report::report_benchmark::{InsertReportBenchmark, QueryReportBenchmark},
        testbed::TestbedId,
        ProjectId,
    },
    schema,
};

pub mod detector;

use detector::Detector;

use super::ReportId;

/// `ReportResults` is used to process the report results.
pub struct ReportResults {
    pub project_id: ProjectId,
    pub branch_id: BranchId,
    pub head_id: HeadId,
    pub testbed_id: TestbedId,
    pub report_id: ReportId,
    pub benchmark_cache: HashMap<BenchmarkName, BenchmarkId>,
    pub measure_cache: HashMap<MeasureNameId, MeasureId>,
    pub detector_cache: HashMap<MeasureId, Option<Detector>>,
}

impl ReportResults {
    pub fn new(
        project_id: ProjectId,
        branch_id: BranchId,
        head_id: HeadId,
        testbed_id: TestbedId,
        report_id: ReportId,
    ) -> Self {
        Self {
            project_id,
            branch_id,
            head_id,
            testbed_id,
            report_id,
            benchmark_cache: HashMap::new(),
            measure_cache: HashMap::new(),
            detector_cache: HashMap::new(),
        }
    }

    pub async fn process(
        &mut self,
        log: &Logger,
        context: &ApiContext,
        results_array: &[&str],
        adapter: Adapter,
        settings: JsonReportSettings,
        #[cfg(feature = "plus")] usage: &mut u32,
    ) -> Result<(), HttpError> {
        let adapter_settings = AdapterSettings::new(settings.average);
        let results_array = AdapterResultsArray::new(results_array, adapter, adapter_settings)
            .map_err(|e| {
                bad_request_error(format!(
                    "Failed to convert results with adapter ({adapter} | {settings:?}): {e}\n\nAre you sure {adapter} is the right adapter?\nRead more about adapters here: https://bencher.dev/docs/explanation/adapters/"
                ))
            })?;

        if let Some(fold) = settings.fold {
            let results = results_array.fold(fold);
            self.results(
                log,
                context,
                Iteration::default(),
                results,
                #[cfg(feature = "plus")]
                usage,
            )
            .await?;
        } else {
            for (iteration, results) in results_array.inner.into_iter().enumerate() {
                self.results(
                    log,
                    context,
                    iteration.into(),
                    results,
                    #[cfg(feature = "plus")]
                    usage,
                )
                .await?;
            }
        };

        Ok(())
    }

    async fn results(
        &mut self,
        log: &Logger,
        context: &ApiContext,
        iteration: Iteration,
        results: AdapterResults,
        #[cfg(feature = "plus")] usage: &mut u32,
    ) -> Result<(), HttpError> {
        for (benchmark_name, metrics) in results.inner {
            self.metrics(
                log,
                context,
                iteration,
                &benchmark_name,
                metrics,
                #[cfg(feature = "plus")]
                usage,
            )
            .await?;
        }
        Ok(())
    }

    async fn metrics(
        &mut self,
        log: &Logger,
        context: &ApiContext,
        iteration: Iteration,
        benchmark_name: &BenchmarkName,
        metrics: AdapterMetrics,
        #[cfg(feature = "plus")] usage: &mut u32,
    ) -> Result<(), HttpError> {
        // If benchmark name is ignored then strip the special suffix before querying
        let (benchmark_name, ignore_benchmark) = benchmark_name.to_strip_ignore();
        let benchmark_id = self.benchmark_id(context, benchmark_name).await?;

        let insert_report_benchmark =
            InsertReportBenchmark::from_json(self.report_id, iteration, benchmark_id);
        diesel::insert_into(schema::report_benchmark::table)
            .values(&insert_report_benchmark)
            .execute(conn_lock!(context))
            .map_err(resource_conflict_err!(
                ReportBenchmark,
                insert_report_benchmark
            ))?;
        let report_benchmark_id =
            QueryReportBenchmark::get_id(conn_lock!(context), insert_report_benchmark.uuid)?;

        for (measure_key, metric) in metrics.inner {
            let measure_id = self.measure_id(context, measure_key).await?;

            let insert_metric = InsertMetric::from_json(report_benchmark_id, measure_id, metric);
            diesel::insert_into(schema::metric::table)
                .values(&insert_metric)
                .execute(conn_lock!(context))
                .map_err(resource_conflict_err!(Metric, insert_metric))?;

            #[cfg(feature = "plus")]
            {
                // Increment usage count
                *usage += 1;
            }

            let Some(detector) = self.detector(context, measure_id).await else {
                continue;
            };
            let query_metric = QueryMetric::from_uuid(conn_lock!(context), insert_metric.uuid).map_err(|e| {
                    issue_error(
                        "Failed to find metric",
                        &format!("Failed to find new metric ({insert_metric:?}) for report benchmark ({insert_report_benchmark:?}) even though it was just created."),
                        e,
                    )
                })?;
            detector
                .detect(log, context, benchmark_id, &query_metric, ignore_benchmark)
                .await?;
        }

        Ok(())
    }

    async fn benchmark_id(
        &mut self,
        context: &ApiContext,
        benchmark_name: BenchmarkName,
    ) -> Result<BenchmarkId, HttpError> {
        Ok(
            if let Some(id) = self.benchmark_cache.get(&benchmark_name) {
                *id
            } else {
                let benchmark_id =
                    QueryBenchmark::get_or_create(context, self.project_id, benchmark_name.clone())
                        .await?;
                self.benchmark_cache.insert(benchmark_name, benchmark_id);
                benchmark_id
            },
        )
    }

    async fn measure_id(
        &mut self,
        context: &ApiContext,
        measure: MeasureNameId,
    ) -> Result<MeasureId, HttpError> {
        Ok(if let Some(id) = self.measure_cache.get(&measure) {
            *id
        } else {
            let measure_id =
                QueryMeasure::get_or_create(context, self.project_id, &measure).await?;
            self.measure_cache.insert(measure, measure_id);
            measure_id
        })
    }

    async fn detector(&mut self, context: &ApiContext, measure_id: MeasureId) -> Option<Detector> {
        if let Some(detector) = self.detector_cache.get(&measure_id) {
            detector.clone()
        } else {
            let detector = Detector::new(
                conn_lock!(context),
                self.branch_id,
                self.head_id,
                self.testbed_id,
                measure_id,
            );
            self.detector_cache.insert(measure_id, detector.clone());
            detector
        }
    }
}
