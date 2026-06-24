const express = require('express');
const path = require('path');
const fs = require('fs');

const router = express.Router();

const PROJECT_ROOT = path.join(__dirname, '..', '..');
const VERSION_FILE = path.join(PROJECT_ROOT, 'version.json');
const CHANGELOG_FILE = path.join(PROJECT_ROOT, 'docs', 'changelog.json');

function readJsonFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
  return JSON.parse(raw);
}

function readJsonFileSafe(filePath, fallback) {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }

  try {
    return readJsonFile(filePath);
  } catch (_) {
    return fallback;
  }
}

router.get('/changelog', (req, res) => {
  try {
    const versionInfo = readJsonFileSafe(VERSION_FILE, {});
    const changelog = readJsonFileSafe(CHANGELOG_FILE, { releases: [] });
    const releases = Array.isArray(changelog.releases) ? changelog.releases : [];

    return res.json({
      success: true,
      data: {
        currentVersion: String(versionInfo.version || ''),
        lastUpdated: String(versionInfo.lastUpdated || ''),
        updatedAt: String(changelog.updatedAt || ''),
        releases,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

module.exports = router;
