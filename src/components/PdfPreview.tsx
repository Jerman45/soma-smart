import { useEffect, useRef, useState } from 'react'
import { LoaderCircle } from 'lucide-react'
import { Document, Page, pdfjs } from 'react-pdf'
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker

export default function PdfPreview({ file, title }: { file: string; title: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(0)
  const [numPages, setNumPages] = useState(0)
  const [pageNumber, setPageNumber] = useState(1)
  const [zoom, setZoom] = useState(1)

  useEffect(() => {
    const element = containerRef.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => setContainerWidth(entry.contentRect.width))
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  return <div className="pdf-viewer" aria-label={`PDF preview of ${title}`}>
    <div className="pdf-toolbar" aria-label="PDF controls">
      <div className="pdf-page-controls">
        <button type="button" onClick={() => setPageNumber((current) => Math.max(1, current - 1))} disabled={pageNumber <= 1} aria-label="Previous PDF page">‹</button>
        <span><input aria-label="Current PDF page" type="number" min={1} max={numPages || 1} value={pageNumber} onChange={(event) => setPageNumber(Math.min(numPages || 1, Math.max(1, Number(event.target.value) || 1)))} /> / {numPages || '—'}</span>
        <button type="button" onClick={() => setPageNumber((current) => Math.min(numPages, current + 1))} disabled={!numPages || pageNumber >= numPages} aria-label="Next PDF page">›</button>
      </div>
      <div className="pdf-zoom-controls"><button type="button" onClick={() => setZoom((current) => Math.max(.6, current - .1))} disabled={zoom <= .6} aria-label="Zoom out">−</button><span>{Math.round(zoom * 100)}%</span><button type="button" onClick={() => setZoom((current) => Math.min(1.8, current + .1))} disabled={zoom >= 1.8} aria-label="Zoom in">+</button></div>
    </div>
    <div className="pdf-page-area" ref={containerRef}>
      <Document file={file} onLoadSuccess={({ numPages: count }) => { setNumPages(count); setPageNumber(1) }} loading={<p className="pdf-state"><LoaderCircle className="spinner" size={22} /> Loading PDF preview…</p>} error={<p className="pdf-state">This PDF could not be previewed. Use the download button to open it on your device.</p>} noData={<p className="pdf-state">No PDF document was provided.</p>}>
        {containerWidth > 0 && <Page pageNumber={pageNumber} width={Math.max(200, Math.min(1080, containerWidth - 38) * zoom)} renderTextLayer renderAnnotationLayer />}
      </Document>
    </div>
  </div>
}
