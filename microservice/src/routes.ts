import express, { Request, Response } from 'express';
import { CodingFactory, CodingSchemeFactory, ToTextFactory } from '@iqb/responses';
import path from 'path';
import fs from 'fs';

export const router = express.Router();

// Error handling helper
const handleError = (res: Response, error: unknown) => {
  console.error(error);
  res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
};

// --- Documentation Page ---

router.get('/', (req: Request, res: Response) => {
  const htmlPath = path.join(__dirname, 'index.html');
  if (fs.existsSync(htmlPath)) {
    res.sendFile(htmlPath);
  } else {
    res.status(404).send('Documentation page not found');
  }
});

// --- CodingFactory Endpoints ---

router.post('/codings/code', (req: Request, res: Response) => {
  try {
    const { response, coding } = req.body;
    if (!response || !coding) {
      return res.status(400).json({ error: 'Missing response or coding in body' });
    }
    const result = CodingFactory.code(response, coding);
    res.json(result);
  } catch (error) {
    handleError(res, error);
  }
});

// --- CodingSchemeFactory Endpoints ---

router.post('/schemes/code', (req: Request, res: Response) => {
  try {
    const { unitResponses, variableCodings } = req.body;
    if (!unitResponses || !variableCodings) {
      return res.status(400).json({ error: 'Missing unitResponses or variableCodings in body' });
    }
    const result = CodingSchemeFactory.code(unitResponses, variableCodings);
    res.json(result);
  } catch (error) {
    handleError(res, error);
  }
});

router.post('/schemes/validate', (req: Request, res: Response) => {
  try {
    const { baseVariables, variableCodings } = req.body;
    if (!baseVariables || !variableCodings) {
      return res.status(400).json({ error: 'Missing baseVariables or variableCodings in body' });
    }
    const result = CodingSchemeFactory.validate(baseVariables, variableCodings);
    res.json(result);
  } catch (error) {
    handleError(res, error);
  }
});

router.post('/schemes/derive-value', (req: Request, res: Response) => {
  try {
    const { variableCodings, coding, sourceResponses } = req.body;
    if (!variableCodings || !coding || !sourceResponses) {
      return res.status(400).json({ error: 'Missing variableCodings, coding, or sourceResponses in body' });
    }
    const result = CodingSchemeFactory.deriveValue(variableCodings, coding, sourceResponses);
    res.json(result);
  } catch (error) {
    handleError(res, error);
  }
});

// --- ToTextFactory Endpoints ---

router.post('/text/code', (req: Request, res: Response) => {
  try {
    const { code, mode } = req.body;
    if (!code) {
      return res.status(400).json({ error: 'Missing code in body' });
    }
    const result = ToTextFactory.codeAsText(code, mode || 'EXTENDED');
    res.json(result);
  } catch (error) {
    handleError(res, error);
  }
});

router.post('/text/source', (req: Request, res: Response) => {
  try {
    const { variableId, sourceType, sources, parameters } = req.body;
    if (!variableId || !sourceType) {
      return res.status(400).json({ error: 'Missing variableId or sourceType in body' });
    }
    const result = ToTextFactory.sourceAsText(variableId, sourceType, sources || [], parameters);
    res.json({ text: result });
  } catch (error) {
    handleError(res, error);
  }
});

router.post('/text/processing', (req: Request, res: Response) => {
  try {
    const { processing, fragmenting } = req.body;
    const result = ToTextFactory.processingAsText(processing || [], fragmenting);
    res.json({ text: result });
  } catch (error) {
    handleError(res, error);
  }
});

router.post('/text/var-info', (req: Request, res: Response) => {
  try {
    const { varInfo } = req.body;
    if (!varInfo) {
      return res.status(400).json({ error: 'Missing varInfo in body' });
    }
    const result = ToTextFactory.varInfoAsText(varInfo);
    res.json(result);
  } catch (error) {
    handleError(res, error);
  }
});
