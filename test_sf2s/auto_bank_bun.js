#!/usr/bin/env bun
/**
 * Example usage:
 *   bun run auto_bank_bun.js
 *
 * This single script will:
 *   1) Look for .sf2 files in the current directory.
 *   2) For each .sf2 file, spawn a Python companion script (parse_sf2.py)
 *      to parse the presets into JSON.
 *   3) Build a final YAML with 'router_rules', 'patches', 'init', 'fluidsettings'.
 *   4) Write <currentDirName>.yaml and auto_bank_run_log.txt.
 */

import fs from "fs";
import path from "path";
import yaml from "js-yaml";
import { $ } from "bun"; // Bun's built-in for spawning processes

// 1) Define your header and footer
const header = {
  router_rules: [
    { type: 'cc', chan: '1=2-6', par1: 1 },
    { type: 'cc', chan: '1=2-10', par1: 7 },
    { type: 'cc', chan: '1=2-6', par1: 64 },
    { type: 'cc', chan: '1=2-16', par1: 91 },
    { type: 'cc', chan: '1=2-16', par1: 93 },
    { type: 'pbend', chan: '1=2-6' },
  ],
};

const footer = {
  init: {
    messages: [
      'cc:1:75:30',
      'cc:1:92:80',
      'cc:5:37:80',
      'cc:5:71:0',
      'cc:5:73:0',
      'cc:5:74:0',
      'cc:6:37:80',
      'cc:6:71:0',
      'cc:6:73:0',
      'cc:6:74:0',
      'cc:13:7:0',
    ],
  },
  fluidsettings: {
    'synth.reverb.room-size': 0.3,
    'synth.reverb.damp': null,
  },
};

// 2) Function to call Python and parse the .sf2 file
async function parseSf2File(sf2FilePath) {
  // We assume `parse_sf2.py` is in the same directory or in PATH.
  // If needed, specify the exact path, e.g.: ./parse_sf2.py
  const { stdout, stderr, exitCode } = await $`python3 parse_sf2.py --file ${sf2FilePath}`;
  if (exitCode !== 0) {
    throw new Error(stderr.trim() || `Failed to parse ${sf2FilePath}`);
  }
  // Convert JSON output from Python to JS object
  return JSON.parse(stdout);
}

// 3) Main function
async function generateBankFile() {
  const dirName = path.basename(process.cwd());
  const sf2Files = fs
    .readdirSync(".")
    .filter((f) => f.toLowerCase().endsWith(".sf2"));

  if (!sf2Files.length) {
    throw new Error("No SF2 files found in the directory.");
  }

  // Start final data with the header
  const finalData = { ...header, patches: {} };
  const logEntries = [];

  for (const sf2File of sf2Files) {
    try {
      const presets = await parseSf2File(sf2File);
      if (!presets || presets.length === 0) {
        logEntries.push(`Skipped ${sf2File}: No presets found.`);
        continue;
      }

      // We can track how many times we've inserted each preset name
      // so each gets a 1-based index in the final YAML
      const patchIndexCounts = {};

      for (const preset of presets) {
        const presetName = preset.name || "Unnamed";
        const presetNum = preset.preset;
        const bankNum = preset.bank;

        // If we haven't seen this preset name before, create an object
        if (!finalData.patches[presetName]) {
          finalData.patches[presetName] = {};
          patchIndexCounts[presetName] = 1;
        }

        // Build the left key (like "1", "2", "3", ...)
        const leftKey = String(patchIndexCounts[presetName]++);
        // Build the right value "filename:000:000"
        const presetStr = String(presetNum).padStart(3, '0');
        const bankStr   = String(bankNum).padStart(3, '0');
        const rightVal  = `${sf2File}:${presetStr}:${bankStr}`;

        finalData.patches[presetName][leftKey] = rightVal;
      }

      logEntries.push(`Processed ${sf2File}`);
    } catch (err) {
      logEntries.push(`Skipped ${sf2File}: ${err.message}`);
    }
  }

  // 4) Merge in the footer
  Object.assign(finalData, footer);

  // 5) Write out the .yaml file
  // By default, let's name it after the directory, e.g. "synth.yaml"
  const outYamlName = `${dirName}.yaml`;
  const yamlStr = yaml.dump(finalData, { indent: 2 });
  fs.writeFileSync(outYamlName, yamlStr, "utf8");

  // 6) Write log file
  fs.writeFileSync("auto_bank_run_log.txt", logEntries.join("\n"), "utf8");

  console.log(`Done! Wrote ${outYamlName} and auto_bank_run_log.txt`);
}

// 7) Run it!
generateBankFile().catch((err) => {
  console.error(err);
  process.exit(1);
});

