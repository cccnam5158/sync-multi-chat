# Data Analysis API Reference

## pandas - DataFrame Basics

```python
import pandas as pd

# Create DataFrame
df = pd.DataFrame({'A': [1, 2], 'B': [3, 4]})
df = pd.read_csv("file.csv")
df = pd.read_excel("file.xlsx")
df = pd.read_excel("file.xlsx", sheet_name="Sheet1")

# Quick overview
df.head()        # First 5 rows
df.tail(10)      # Last 10 rows
df.info()        # Column types and non-null counts
df.describe()    # Statistical summary
df.shape         # (rows, columns)
df.columns       # Column names
df.dtypes        # Column data types
```

## pandas - Data Selection

```python
# Select columns
df['column']                    # Single column (Series)
df[['col1', 'col2']]           # Multiple columns (DataFrame)

# Select rows by label
df.loc[0]                       # Row by index
df.loc[0:5]                     # Rows 0 to 5
df.loc[df['age'] > 25]         # Conditional selection

# Select by position
df.iloc[0]                      # First row
df.iloc[0:5]                    # First 5 rows
df.iloc[0:5, 0:3]              # Rows 0-5, columns 0-3

# Query
df.query('age > 25 and salary < 50000')
```

## pandas - Data Cleaning

```python
# Missing values
df.isna()                       # Check for NaN
df.dropna()                     # Remove rows with NaN
df.dropna(subset=['col'])       # Drop rows where 'col' is NaN
df.fillna(0)                    # Fill NaN with 0
df.fillna(method='ffill')       # Forward fill
df.fillna(df.mean())           # Fill with mean

# Duplicates
df.duplicated()                 # Check for duplicates
df.drop_duplicates()            # Remove duplicates
df.drop_duplicates(subset=['col'])  # Based on specific column

# Replace values
df.replace(0, np.nan)           # Replace 0 with NaN
df.replace({'A': {0: 100}})     # Replace 0 with 100 in column A
```

## pandas - Aggregation

```python
# Group by
df.groupby('category').sum()
df.groupby('category').mean()
df.groupby(['cat1', 'cat2']).agg({'col1': 'sum', 'col2': 'mean'})

# Pivot table
pd.pivot_table(df, values='sales', index='region', columns='year', aggfunc='sum')
pd.crosstab(df['cat1'], df['cat2'])

# Statistical functions
df['column'].mean()             # Average
df['column'].median()           # Median
df['column'].std()              # Standard deviation
df['column'].sum()              # Sum
df['column'].count()            # Count non-null values
df['column'].min()              # Minimum
df['column'].max()              # Maximum
df['column'].quantile(0.25)     # 25th percentile
```

## pandas - Merging & Joining

```python
# Merge (SQL-style join)
pd.merge(df1, df2, on='key')                    # Inner join
pd.merge(df1, df2, on='key', how='left')        # Left join
pd.merge(df1, df2, on='key', how='outer')       # Outer join
pd.merge(df1, df2, left_on='id1', right_on='id2')  # Different column names

# Join (index-based)
df1.join(df2, how='left')

# Concatenate
pd.concat([df1, df2])                           # Vertical stack (rows)
pd.concat([df1, df2], axis=1)                   # Horizontal stack (columns)
pd.concat([df1, df2], ignore_index=True)        # Reset index
```

## pandas - Time Series

```python
# Convert to datetime
df['date'] = pd.to_datetime(df['date'])
df['date'] = pd.to_datetime(df['date'], format='%Y-%m-%d')

# Access datetime components
df['year'] = df['date'].dt.year
df['month'] = df['date'].dt.month
df['day'] = df['date'].dt.day
df['weekday'] = df['date'].dt.day_name()

# Set datetime index
df = df.set_index('date')

# Resample (time-based aggregation)
df.resample('D').mean()         # Daily average
df.resample('M').sum()          # Monthly sum
df.resample('Q').mean()         # Quarterly average

# Rolling window
df['rolling_mean'] = df['value'].rolling(window=7).mean()  # 7-day moving average
df['rolling_sum'] = df['value'].rolling(window=30).sum()   # 30-day rolling sum
```

## pandas - Analysis

```python
# Correlation
df.corr()                       # Correlation matrix
df['col1'].corr(df['col2'])    # Correlation between two columns
df.cov()                        # Covariance matrix

# Sorting
df.sort_values('column')                        # Ascending
df.sort_values('column', ascending=False)       # Descending
df.sort_values(['col1', 'col2'])               # Multiple columns

# Ranking
df['rank'] = df['score'].rank()                 # Default ranking
df['rank'] = df['score'].rank(method='dense')   # Dense ranking

# Percentiles
df['column'].quantile(0.25)     # 25th percentile
df['column'].quantile([0.25, 0.5, 0.75])  # Multiple percentiles
```

## numpy - Core Functions

```python
import numpy as np

# Array creation
arr = np.array([1, 2, 3, 4, 5])
arr = np.zeros(10)              # Array of zeros
arr = np.ones(10)               # Array of ones
arr = np.linspace(0, 100, 50)   # 50 evenly spaced values from 0 to 100
arr = np.arange(0, 100, 5)      # 0 to 100, step 5

# Statistical functions
np.mean(arr)                    # Mean
np.median(arr)                  # Median
np.std(arr)                     # Standard deviation
np.var(arr)                     # Variance
np.percentile(arr, 75)          # 75th percentile
np.quantile(arr, 0.75)          # Same as percentile

# Math operations
np.sum(arr)                     # Sum
np.prod(arr)                    # Product
np.min(arr)                     # Minimum
np.max(arr)                     # Maximum
np.cumsum(arr)                  # Cumulative sum
```

## matplotlib - Basic Charts

```python
import matplotlib.pyplot as plt

# Line chart
plt.plot(x, y)
plt.plot(x, y, label='Series 1', color='blue', linewidth=2, linestyle='--')
plt.show()

# Bar chart
plt.bar(categories, values)
plt.barh(categories, values)    # Horizontal bar chart

# Scatter plot
plt.scatter(x, y)
plt.scatter(x, y, s=100, c='red', alpha=0.5)  # Size, color, transparency

# Histogram
plt.hist(data, bins=20)
plt.hist(data, bins=20, edgecolor='black')

# Pie chart
plt.pie(values, labels=labels, autopct='%1.1f%%')
plt.pie(values, labels=labels, autopct='%1.1f%%', startangle=90)

# Multiple subplots
fig, axes = plt.subplots(2, 2, figsize=(10, 8))
axes[0, 0].plot(x, y)
axes[0, 1].bar(categories, values)
```

## matplotlib - Styling & Annotations

```python
# Titles and labels
plt.title('Chart Title')
plt.xlabel('X-axis Label')
plt.ylabel('Y-axis Label')

# Legend
plt.legend()
plt.legend(loc='upper right')
plt.legend(loc='best')

# Grid
plt.grid(True)
plt.grid(alpha=0.3, linestyle='--')

# Axis limits
plt.xlim(0, 100)
plt.ylim(0, 50)

# Save figure
plt.savefig('chart.png')
plt.savefig('chart.png', dpi=300, bbox_inches='tight')
plt.savefig('chart.pdf')  # Vector format
```

## Common Analysis Patterns

```python
# Year-over-Year (YoY) growth rate
df['yoy_growth'] = df.groupby('product')['sales'].pct_change(periods=12) * 100

# Month-over-Month (MoM) growth rate
df['mom_growth'] = df['sales'].pct_change() * 100

# Percentage change
df['pct_change'] = ((df['current'] - df['previous']) / df['previous']) * 100

# Moving average (7-day)
df['ma_7'] = df['value'].rolling(window=7).mean()

# Cumulative sum
df['cumsum'] = df['value'].cumsum()

# Z-score normalization
df['z_score'] = (df['value'] - df['value'].mean()) / df['value'].std()

# Min-Max normalization
df['normalized'] = (df['value'] - df['value'].min()) / (df['value'].max() - df['value'].min())

# Detect outliers (IQR method)
Q1 = df['value'].quantile(0.25)
Q3 = df['value'].quantile(0.75)
IQR = Q3 - Q1
outliers = df[(df['value'] < Q1 - 1.5*IQR) | (df['value'] > Q3 + 1.5*IQR)]

# Compare vs. baseline (e.g., first value)
baseline = df['value'].iloc[0]
df['vs_baseline'] = ((df['value'] - baseline) / baseline) * 100

# Rank within groups
df['rank_in_group'] = df.groupby('category')['value'].rank(ascending=False)
```
