import { Fragment, useEffect, useRef, useState } from 'react';
import { workflowSteps } from '../mockData.js';
import { useWorkbenchData } from '../useWorkbenchData.js';
import {
  createDemoWorkspace,
  fetchChapterSetupBundle,
  generateChapterContent,
  polishChapterContent,
  saveCharacterSummary,
  saveChapterPlan,
  saveOutlineSummary,
  saveStoryline,
  upsertGeneratedChapter
} from '../workbenchApi.js';
import '../app-shell.css';
