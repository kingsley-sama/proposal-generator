import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const runtime = 'nodejs';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: pathSegments } = await params;
  const filePath = path.join(process.cwd(), 'output', ...pathSegments);

  if (!fs.existsSync(filePath)) {
    return new NextResponse('File not found', { status: 404 });
  }

  const fileStats = fs.statSync(filePath);
  const fileBuffer = fs.readFileSync(filePath);
  
  // Basic content type detection
  let contentType = 'application/octet-stream';
  if (filePath.endsWith('.docx')) contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (filePath.endsWith('.pdf')) contentType = 'application/pdf';
  if (filePath.endsWith('.png')) contentType = 'image/png';
  
  const fileName = path.basename(filePath);
  const safeFileName = fileName.replace(/[^\w\s.-]/g, '_');
  
  return new NextResponse(fileBuffer, {
    headers: {
      'Content-Type': contentType,
      'Content-Length': fileStats.size.toString(),
      'Content-Disposition': `attachment; filename="${safeFileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`
    },
  });
}
