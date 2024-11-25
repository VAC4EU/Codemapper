import sys
import pandas as pd
from os import path
from glob import glob

dir = sys.argv[1]
filename = sys.argv[2]

all = pd.read_csv(filename)

def get_codes(df):
    return set(
        f'{row.coding_system}:{row.code}'
        for ix, row in df.iterrows()
        if row.code != '-'
    ) 

all_codes = {}
for name, df in all.groupby('event_abbreviation'):
    all_codes[name] = get_codes(df)

for filename in glob(f'{dir}/*.csv'):
    if filename == f"{dir}/index.csv":
        continue
    name = path.basename(filename).replace('.csv', '').split('_')[1]
    codes = get_codes(pd.read_csv(filename))
    err1 = all_codes[name] - codes
    err2 = codes - all_codes[name]
    print()
    print(name)
    print("- err1", ', '.join(err1))
    print("- err2", ', '.join(err2))
