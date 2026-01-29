import ExpoModulesCore
import swift_vibrant
import UIKit

public class ExpoImageThemeColorsModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ExpoImageThemeColors")

    AsyncFunction("extractThemeColorAsync") { (source: Either<URL, SharedRef<UIImage>>) -> [String: Any] in
        let image: UIImage
        
        if let url: URL = source.get() {
            // Load image from URL
            let data = try Data(contentsOf: url)
            guard let img = UIImage(data: data) else {
                throw Exception(name: "ImageLoadingFailed", description: "Could not load image from URL")
            }
            image = img
        } else if let sharedRef: SharedRef<UIImage> = source.get() {
            image = sharedRef.ref
        } else {
             throw Exception(name: "InvalidSource", description: "Invalid image source provided")
        }

        // Generate palette
        let palette = Vibrant.from(image).getPalette()
        
        return [
            "width": image.size.width,
            "height": image.size.height,
            "dominant": (palette.Vibrant ?? palette.Muted)?.toDictionary() ?? [:],
            "vibrant": palette.Vibrant?.toDictionary() ?? [:],
            "lightVibrant": palette.LightVibrant?.toDictionary() ?? [:],
            "darkVibrant": palette.DarkVibrant?.toDictionary() ?? [:],
            "muted": palette.Muted?.toDictionary() ?? [:],
            "lightMuted": palette.LightMuted?.toDictionary() ?? [:],
            "darkMuted": palette.DarkMuted?.toDictionary() ?? [:]
        ]
    }
  }
}

extension Swatch {
    func toDictionary() -> [String: Any] {
        return [
            "hex": self.uiColor.toHexString(),
            "titleTextColor": self.titleTextColor.toHexString(),
            "bodyTextColor": self.bodyTextColor.toHexString(),
            "population": self.population
        ]
    }
}

extension UIColor {
    func toHexString() -> String {
        var r: CGFloat = 0
        var g: CGFloat = 0
        var b: CGFloat = 0
        var a: CGFloat = 0
        // Use getRed to handle different color spaces (like Display P3)
        if self.getRed(&r, green: &g, blue: &b, alpha: &a) {
            let rgb: Int = (Int)(r*255)<<16 | (Int)(g*255)<<8 | (Int)(b*255)<<0
            return String(format:"#%06X", rgb)
        }
        return "#000000"
    }
}
