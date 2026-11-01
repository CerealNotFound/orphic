// Reads a PDF with macOS's built-in PDFKit (no installs). PDFKit only parses and draws pages: it never runs
// JavaScript, forms actions or embedded files, so an untrusted PDF can't execute anything here.
// Usage: swift pdftext.swift <file.pdf> <out-dir> <max-page-images>
// Writes <out-dir>/text.txt (every page, with page markers) and page-01.png … (first pages, for reading by eye),
// then prints one JSON line: {"pages":N,"title":"…","author":"…","locked":false,"images":K}
import AppKit
import Foundation
import PDFKit

let args = CommandLine.arguments
guard args.count >= 4 else { print("{\"error\":\"usage\"}"); exit(1) }
let input = URL(fileURLWithPath: args[1])
let outDir = URL(fileURLWithPath: args[2])
let maxImages = Int(args[3]) ?? 8

func emit(_ obj: [String: Any]) {
    let data = try! JSONSerialization.data(withJSONObject: obj)
    print(String(data: data, encoding: .utf8)!)
}

guard let doc = PDFDocument(url: input) else { emit(["error": "not a readable PDF"]); exit(0) }
if doc.isLocked { emit(["pages": doc.pageCount, "locked": true]); exit(0) }

var text = ""
for i in 0..<doc.pageCount {
    guard let page = doc.page(at: i) else { continue }
    text += "\n\n--- page \(i + 1) ---\n\n" + (page.string ?? "")
}
try? text.write(to: outDir.appendingPathComponent("text.txt"), atomically: true, encoding: .utf8)

var images = 0
for i in 0..<min(doc.pageCount, maxImages) {
    guard let page = doc.page(at: i) else { continue }
    let bounds = page.bounds(for: .mediaBox)
    let scale = min(1400 / max(bounds.width, 1), 1800 / max(bounds.height, 1), 3)
    let thumb = page.thumbnail(of: NSSize(width: bounds.width * scale, height: bounds.height * scale), for: .mediaBox)
    guard let tiff = thumb.tiffRepresentation, let rep = NSBitmapImageRep(data: tiff),
          let png = rep.representation(using: .png, properties: [:]) else { continue }
    let name = String(format: "page-%02d.png", i + 1)
    if (try? png.write(to: outDir.appendingPathComponent(name))) != nil { images += 1 }
}

let attrs = doc.documentAttributes ?? [:]
emit([
    "pages": doc.pageCount,
    "title": (attrs[PDFDocumentAttribute.titleAttribute] as? String) ?? "",
    "author": (attrs[PDFDocumentAttribute.authorAttribute] as? String) ?? "",
    "locked": false,
    "images": images,
])
