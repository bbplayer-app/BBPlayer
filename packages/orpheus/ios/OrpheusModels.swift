import ExpoModulesCore

struct Track: Record {
  @Field
  var id: String = ""
  
  @Field
  var url: String = ""
  
  @Field
  var title: String?
  
  @Field
  var artist: String?
  
  @Field
  var artwork: String?
  
  @Field
  var duration: Double?
}

extension Track {
    var dictionaryRepresentation: [String: Any] {
        var dict: [String: Any] = [
            "id": id,
            "url": url
        ]
        if let title = title { dict["title"] = title }
        if let artist = artist { dict["artist"] = artist }
        if let artwork = artwork { dict["artwork"] = artwork }
        if let duration = duration { dict["duration"] = duration }
        return dict
    }
    
    init?(dictionary: [String: Any]) {
        guard let id = dictionary["id"] as? String,
              let url = dictionary["url"] as? String else { return nil }
              
        self.init()
        self.id = id
        self.url = url
        self.title = dictionary["title"] as? String
        self.artist = dictionary["artist"] as? String
        self.artwork = dictionary["artwork"] as? String
        self.duration = dictionary["duration"] as? Double
    }
}

enum PlaybackState: Int, Enumerable {
  case idle = 1
  case buffering = 2
  case ready = 3
  case ended = 4
}

enum RepeatMode: Int, Enumerable {
  case off = 0
  case track = 1
  case queue = 2
}

enum TransitionReason: Int, Enumerable {
  case repeatMode = 0
  case auto = 1
  case seek = 2
  case playlistChanged = 3
}

enum DownloadState: Int, Enumerable {
  case queued = 0
  case stopped = 1
  case downloading = 2
  case completed = 3
  case failed = 4
  case removing = 5
  case restarting = 7
}

struct DownloadTask: Record {
  @Field
  var id: String = ""
  
  @Field
  var state: DownloadState = .queued
  
  @Field
  var percentDownloaded: Double = 0.0
  
  @Field
  var bytesDownloaded: Double = 0.0
  
  @Field
  var contentLength: Double = 0.0
  
  @Field
  var track: Track?
}
