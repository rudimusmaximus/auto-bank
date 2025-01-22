#!/usr/bin/env bun

import fs from "fs";
import path from "path";
import yaml from "js-yaml";
import { $ } from "bun";

// 1) parseSf2File function to call Python parser
async function parseSf2File(sf2FilePath) {
  const { stdout, stderr, exitCode } = await $`python3 parse_sf2.py --file ${sf2FilePath}`;
  if (exitCode !== 0) {
    throw new Error(stderr.trim() || `Failed to parse ${sf2FilePath}`);
  }
  return JSON.parse(stdout);
}

// 2) Main function
async function generateBankFile() {
  const dirName = path.basename(process.cwd());

  // Load the base YAML template
  const baseYaml = fs.readFileSync("base_bank.yaml", "utf8");
  let finalData = yaml.load(baseYaml);

  // Ensure patches key exists
  if (!finalData.patches) {
    finalData.patches = {};
  }

  // Find all SF2 files in the current directory
  const sf2Files = fs
    .readdirSync(".")
    .filter((f) => f.toLowerCase().endsWith(".sf2"));

  if (!sf2Files.length) {
    throw new Error("No SF2 files found in the directory.");
  }

  const logEntries = [];

  // For each SF2, parse presets and add to finalData.patches
  for (const sf2File of sf2Files) {
    try {
      const presets = await parseSf2File(sf2File);
      if (!presets || presets.length === 0) {
        logEntries.push(`Skipped ${sf2File}: No presets found.`);
        continue;
      }

      const patchIndexCounts = {};
      for (const preset of presets) {
        const presetName = preset.name || "Unnamed";
        const presetNum = preset.preset;
        const bankNum = preset.bank;

        // Create an object for this patch name if not present
        if (!finalData.patches[presetName]) {
          finalData.patches[presetName] = {};
          patchIndexCounts[presetName] = 1;
        }

        // Generate channel-style key (1,2,3...)
        const leftKey = String(patchIndexCounts[presetName]++);
        // Build soundfont reference (sf2File:NNN:NNN)
        const presetStr = String(presetNum).padStart(3, "0");
        const bankStr = String(bankNum).padStart(3, "0");
        const rightVal = `${sf2File}:${presetStr}:${bankStr}`;

        finalData.patches[presetName][leftKey] = rightVal;
      }

      logEntries.push(`Processed ${sf2File}`);
    } catch (err) {
      logEntries.push(`Skipped ${sf2File}: ${err.message}`);
    }
  }

  // ===== New step: Sort patch names alphabetically =====
  const patchNames = Object.keys(finalData.patches);
  patchNames.sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }));

  const sortedPatches = {};
  for (const name of patchNames) {
    sortedPatches[name] = finalData.patches[name];
  }
  finalData.patches = sortedPatches;
  // ====================================================

  // Write final YAML
  const outYamlName = `${dirName}.yaml`;
  const yamlStr = yaml.dump(finalData, { indent: 2 });
  fs.writeFileSync(outYamlName, yamlStr, "utf8");

  // Write log file
  fs.writeFileSync("auto_bank_run_log.txt", logEntries.join("\n"), "utf8");

  console.log(`Done! Wrote ${outYamlName} and auto_bank_run_log.txt`);
}

// 3) Execute
generateBankFile().catch((err) => {
  console.error(err);
  process.exit(1);
});

