# Stratified Sampling in Large-Scale Household Surveys

## 1 Purpose of Stratification

Stratification is the division of a survey population into non-overlapping and exhaustive
sub-populations called strata, from which independent samples are then drawn. The purpose of
stratification is to increase the precision of survey estimates without increasing the sample
size. Precision improves because the variance of a stratified estimator depends only on the
variation within strata and not on the variation between them. When strata are constructed so
that units inside a stratum resemble one another on the study variable, the within-stratum
variance is small and the gain in precision is large.

A second purpose of stratification is administrative. Independent samples within strata allow
field work to be organised state by state or district by district, and they guarantee that every
domain of interest is represented in the sample. A third purpose is to permit different sampling
procedures in different parts of the population, which is common in Indian surveys where rural
and urban sectors are treated as separate strata with different frames.

## 2 Construction of Strata

The variable used to form strata is called the stratification variable. A good stratification
variable is correlated with the study variable and is available for every unit on the sampling
frame before selection. In household surveys conducted by the National Sample Survey Office the
strata are commonly formed by district and by sector, and sub-strata are formed within districts
using auxiliary information from the population census.

Strata must be mutually exclusive and collectively exhaustive. Every unit in the population must
belong to exactly one stratum, and no unit may belong to two strata. Where the stratification
variable is continuous, boundaries are chosen so that the cumulative square root of the frequency
is approximately equal across strata, a rule due to Dalenius and Hodges. Increasing the number of
strata yields diminishing returns, and beyond six to eight strata for a single stratification
variable the additional gain in precision is usually negligible.

## 3 Allocation of the Sample

Allocation is the decision of how many units to select from each stratum. Under proportional
allocation the sample size in a stratum is proportional to the size of that stratum in the
population, so that the overall sampling fraction is constant and the sample is self-weighting.
Proportional allocation is simple to administer and requires no information beyond stratum sizes.

Under Neyman allocation the sample size in a stratum is proportional to the product of the stratum
size and the standard deviation of the study variable within that stratum. Neyman allocation
minimises the variance of the estimated population total for a fixed total sample size. It
requires prior knowledge of the within-stratum standard deviations, which in practice are taken
from a previous round of the same survey or from a pilot enquiry.

Optimal allocation extends Neyman allocation by also accounting for the cost of enumerating a unit
in each stratum. Where a stratum is expensive to survey, optimal allocation reduces the sample
size in that stratum relative to Neyman allocation. In surveys with sparsely populated or
difficult terrain the cost differential between strata can be large enough to change the
allocation materially.

## 4 Estimation from a Stratified Sample

The stratified estimator of the population mean is the weighted sum of the stratum sample means,
where the weight for a stratum is the proportion of the population falling in that stratum. The
estimator is unbiased provided that selection within each stratum is unbiased and that the stratum
weights are known without error.

The variance of the stratified mean is the weighted sum of the within-stratum variances, with each
within-stratum variance weighted by the square of the stratum weight and divided by the stratum
sample size. Because the between-stratum component does not appear, a stratified design is never
less efficient than simple random sampling of the same total size, provided the allocation is
proportional or better and the stratum weights are correct.

The design effect is the ratio of the variance under the actual design to the variance that would
have been obtained under simple random sampling of the same total sample size. A design effect
below one indicates that stratification has improved precision. In multistage designs the design
effect commonly exceeds one because clustering inflates the variance, and stratification is used
in part to offset that inflation.

## 5 Common Errors in Practice

The most frequent error is the use of a stratification variable that is unrelated to the study
variable, which produces administrative convenience but no gain in precision. The second most
frequent error is the use of stratum weights taken from an outdated frame, which introduces bias
that no amount of sample size can remove.

A third error is to apply Neyman allocation using within-stratum standard deviations estimated
from the current sample rather than from prior information, which makes the allocation dependent
on the data it is meant to be estimating. A fourth error is to collapse strata after selection in
order to simplify estimation, which invalidates the variance formula and understates the true
standard error of the estimate.
