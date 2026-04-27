import express, { Request, Response } from 'express';
import { CodingFactory, CodingSchemeFactory, ToTextFactory } from '@iqb/responses';
import path from 'path';
import fs from 'fs';
import rateLimit from 'express-rate-limit';

export const router = express.Router();

// Rate limiter for documentation page (file access)
const docLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again after 15 minutes'
});

// --- Version Info ---

const getPackageVersions = () => {
  const versions = {
    microservice: 'unknown',
    library: 'unknown'
  };

  const findVersion = (pkgName: string, searchPaths: string[]): string => {
    // eslint-disable-next-line no-restricted-syntax
    for (const pkgPath of searchPaths) {
      try {
        if (fs.existsSync(pkgPath)) {
          const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
          if (pkg.name === pkgName && pkg.version) {
            return pkg.version;
          }
        }
      } catch (e) { /* ignore */ }
    }
    return 'unknown';
  };

  // 1. Get Microservice Version
  versions.microservice = findVersion('responses-microservice', [
    path.join(__dirname, '..', 'package.json'), // Dev: src/ -> ..
    path.join(__dirname, '..', '..', '..', 'package.json'), // Dist: dist/microservice/src/ -> ../../../
    path.join(process.cwd(), 'package.json'), // In case it's run from microservice root
    path.join(process.cwd(), 'microservice', 'package.json') // In case it's run from repo root
  ]);

  // 2. Get Library Version (@iqb/responses)
  versions.library = findVersion('@iqb/responses', [
    path.join(__dirname, '..', '..', 'package.json'), // Dev: src/ -> ../..
    path.join(__dirname, '..', '..', '..', '..', '..', 'package.json'), // Dist: dist/microservice/src/ -> ../../../../../
    path.join(__dirname, '..', '..', 'node_modules', '@iqb/responses', 'package.json'), // node_modules dev
    path.join(__dirname, '..', '..', '..', 'node_modules', '@iqb/responses', 'package.json'), // node_modules dist
    path.join(process.cwd(), '..', 'package.json'), // Up from microservice root
    path.join(process.cwd(), 'package.json') // If run from repo root
  ]);

  return versions;
};

const versions = getPackageVersions();

// Error handling helper
const handleError = (res: Response, error: unknown) => {
  // eslint-disable-next-line no-console
  console.error(error);
  res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
};

// --- Documentation Page ---

router.get('/', docLimit, (req: Request, res: Response) => {
  const htmlPath = path.join(__dirname, 'index.html');
  if (fs.existsSync(htmlPath)) {
    let html = fs.readFileSync(htmlPath, 'utf8');
    html = html.replace(/{{LIBRARY_VERSION}}/g, versions.library);
    html = html.replace(/{{MICROSERVICE_VERSION}}/g, versions.microservice);
    res.send(html);
  } else {
    res.status(404).send('Documentation page not found');
  }
});

router.get('/version', (req: Request, res: Response) => {
  res.json(versions);
});

// --- CodingFactory Endpoints ---

router.post('/codings/code', (req: Request, res: Response) => {
  try {
    const { response, coding } = req.body;
    if (!response || !coding) {
      res.status(400).json({ error: 'Missing response or coding in body' });
      return;
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
      res.status(400).json({ error: 'Missing unitResponses or variableCodings in body' });
      return;
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
      res.status(400).json({ error: 'Missing baseVariables or variableCodings in body' });
      return;
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
      res.status(400).json({ error: 'Missing variableCodings, coding, or sourceResponses in body' });
      return;
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
      res.status(400).json({ error: 'Missing code in body' });
      return;
    }
    const result = ToTextFactory.codeAsText(code, mode || 'EXTENDED');
    res.json(result);
  } catch (error) {
    handleError(res, error);
  }
});

router.post('/text/source', (req: Request, res: Response) => {
  try {
    const {
      variableId,
      sourceType,
      sources,
      parameters
    } = req.body;
    if (!variableId || !sourceType) {
      res.status(400).json({ error: 'Missing variableId or sourceType in body' });
      return;
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
      res.status(400).json({ error: 'Missing varInfo in body' });
      return;
    }
    const result = ToTextFactory.varInfoAsText(varInfo);
    res.json(result);
  } catch (error) {
    handleError(res, error);
  }
});
