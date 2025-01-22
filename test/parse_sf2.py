#!/usr/bin/env python3
import argparse
import json
import sys
from sf2utils.sf2parse import Sf2File


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--file", required=True, help="Path to the .sf2 file")
    args = parser.parse_args()

    sf2_path = args.file
    try:
        with open(sf2_path, 'rb') as sf2_file:
            sf2 = Sf2File(sf2_file)

            presets_info = []
            for p in sf2.presets:
                if hasattr(p, 'preset') and hasattr(p, 'bank'):
                    presets_info.append({
                        "name": p.name,
                        "preset": p.preset,
                        "bank": p.bank,
                    })
            print(json.dumps(presets_info))

    except Exception as e:
        print(str(e), file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
