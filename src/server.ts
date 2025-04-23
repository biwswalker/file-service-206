import express, { Request, Response } from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { promisify } from "util";
import { pipeline } from "stream";

const fileInfo = promisify(fs.stat);

const app = express();
const port = process.env.PORT || 4000;

app.use(cors());

app.get("/api/pdf-stream", (_: Request, res: Response): void => {
  const filePath = path.join(__dirname, "..", "files", "19mb.pdf");

  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: "File not found" });
    return;
  }

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", "inline; filename=sample.pdf");

  const stream = fs.createReadStream(filePath);
  stream.pipe(res);
});

/**
 * 
 */
app.get("/api/pdf-range-request", async (req: Request, res: Response): Promise<void> => {
  const filePath = path.join(__dirname, "..", "files", "19mb_2.pdf");

  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: "File not found" });
    return;
  }

  const { size } = await fileInfo(filePath);
  const range = req.headers.range;

  console.log("Range Header: ", range);
  if (range) {
    /** Extracting Start and End value from Range Hea der */
    let [start, end] = range.replace(/bytes=/, "").split("-");
    let _start = parseInt(start, 10);
    let _end = end ? parseInt(end, 10) : size - 1;

    if (!isNaN(_start) && isNaN(_end)) {
      _start = _start;
      _end = size - 1;
    }
    if (isNaN(_start) && !isNaN(_end)) {
      _start = size - _end;
      _end = size - 1;
    }

    // Handle unavailable range request
    if (_start >= size || _end >= size) {
      // Return the 416 Range Not Satisfiable.
      res.writeHead(416, {
        "Content-Range": `bytes */${size}`,
      });
      res.end();
      return 
    }

    /** Sending Partial Content With HTTP Code 206 */
    res.writeHead(206, {
      "Content-Range": `bytes ${start}-${end}/${size}`,
      "Accept-Ranges": "bytes",
      "Content-Length": _end - _start + 1,
      "Content-Type": "application/psdf",
    });

    const readable = fs.createReadStream(filePath, {
      start: _start,
      end: _end,
    });
    pipeline(readable, res, (err) => {
      console.log(err);
    });
  } else {
    res.writeHead(200, {
      "Access-Control-Expose-Headers": "Accept-Ranges",
      "Access-Control-Allow-Headers": "Accept-Ranges,range",
      "Accept-Ranges": "bytes",
      "Content-Length": size,
      "Content-Type": "application/pdf",
      "Content-Encoding": "",
    });

    if (req.method === "GET") {
      const readable = fs.createReadStream(filePath);
      pipeline(readable, res, (err) => {
        console.log(err);
      });
    } else {
      res.end();
    }
  }
});

app.get("/api/pdf-base64", (_: Request, res: Response): void => {
  const filePath = path.join(__dirname, "..", "files", "19mb.pdf");
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: "File not found" });
    return;
  }
  const binaryData = fs.readFileSync(filePath);
  const base64 = binaryData.toString("base64");
  res.json({
    fileName: "sample.pdf",
    base64: base64,
    // base64: `data:application/pdf;base64,${base64}`,
  });
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
