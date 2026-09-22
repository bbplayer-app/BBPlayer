import ExpoModulesCore
import swift_vibrant
import UIKit

struct SwatchRecord: Record {
  @Field
  var hex: String = ""

  @Field
  var titleTextColor: String = ""

  @Field
  var bodyTextColor: String = ""

  @Field
  var population: Int = 0
}

struct PaletteRecord: Record {
  @Field
  var width: Double = 0

  @Field
  var height: Double = 0

  @Field
  var dominant: SwatchRecord?

  @Field
  var vibrant: SwatchRecord?

  @Field
  var lightVibrant: SwatchRecord?

  @Field
  var darkVibrant: SwatchRecord?

  @Field
  var muted: SwatchRecord?

  @Field
  var lightMuted: SwatchRecord?

  @Field
  var darkMuted: SwatchRecord?
}

public class ExpoImageThemeColorsModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ExpoImageThemeColors")

    AsyncFunction("extractThemeColorAsync") { (source: Either<URL, SharedRef<UIImage>>) -> PaletteRecord in
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
        
        let record = PaletteRecord()
        record.width = Double(image.size.width)
        record.height = Double(image.size.height)
        record.dominant = (palette.Vibrant ?? palette.Muted)?.toRecord()
        record.vibrant = palette.Vibrant?.toRecord()
        record.lightVibrant = palette.LightVibrant?.toRecord()
        record.darkVibrant = palette.DarkVibrant?.toRecord()
        record.muted = palette.Muted?.toRecord()
        record.lightMuted = palette.LightMuted?.toRecord()
        record.darkMuted = palette.DarkMuted?.toRecord()

        return record
    }
  }
}

extension Swatch {
    func toRecord() -> SwatchRecord {
        let record = SwatchRecord()
        record.hex = self.uiColor.toHexString()
        record.titleTextColor = self.titleTextColor.toHexString()
        record.bodyTextColor = self.bodyTextColor.toHexString()
        record.population = self.population
        return record
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
