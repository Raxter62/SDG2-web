# FAO country CSV builder

This package builds one CSV per country/region found in `requested_entities.csv`.

It downloads two FAO-sourced datasets from Our World in Data:
1. prevalence-of-undernourishment.csv
2. share-of-population-with-severe-food-insecurity.csv

Why these URLs?
- The undernourishment page states the source is FAO SDG Indicators.
- The severe food insecurity page states the source is FAO Food Security and Nutrition: Suite of Food Security Indicators (FS).

## Run

```bash
python build_country_csvs.py
```

## Output

- `output_country_csvs/` : one CSV per country/region
- `combined_selected_countries.csv` : all selected entities merged together
- `unmatched_entities.csv` : entities from your file that could not be matched exactly

## Notes
- This script uses fuzzy name matching for a few OWID/FAO country-name differences.
- If a country has no value for one indicator in a given year, the field is left blank.