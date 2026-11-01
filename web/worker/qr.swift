// Decodes QR codes in images with macOS's built-in Core Image (no installs). Usage: swift qr.swift a.jpg b.jpg …
// Prints one line per code: <file>\t<payload>
import CoreImage
import Foundation

let detector = CIDetector(ofType: CIDetectorTypeQRCode, context: nil, options: [CIDetectorAccuracy: CIDetectorAccuracyHigh])!
for path in CommandLine.arguments.dropFirst() {
    guard let image = CIImage(contentsOf: URL(fileURLWithPath: path)) else { continue }
    for case let f as CIQRCodeFeature in detector.features(in: image) {
        if let payload = f.messageString { print("\(path)\t\(payload)") }
    }
}
