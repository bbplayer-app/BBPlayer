## [5.5.0] - 07-09-2025

- Add extension on Crashlytics errors (as fileName)

## [5.4.0] - 06-09-2025

- Fix Readme (issue #115)
- Fix Sentry compatibility (issue #118)
- Fix Crashlytics error report (issue #110)
- Crashlytics: a log is only recorded as an error if its level matches a level defined in the `errorLevels` option
- Improve object serialization logic
- Change FS packages type to any (issue #112)
- Minor bugfix

## [5.3.0] - 25-10-2024

- Improve type definitions (pr #109 by @DanielSRS)
- Minor bugfix

#### BREAKING CHANGES (only for typescript config)

Starting from version v 5.3.0, the definition of types has been improved: transportOptions are now strongly typed based on the specific transport specified in the configuration, and it is no longer necessary to specify log level types, as these are also taken directly from the configuration.

The configuration must be passed inline for it to work correctly and the log level type definitions that needed to be set up until version 5.2.2 must now be removed:

```typescript
import { logger } from 'react-native-logs'

var log = logger.createLogger({
	levels: {
		trace: 0,
		info: 1,
		error: 2,
	},
})

log.trace('message') // correct log call
log.silly('message') // typescript error, "silly" method does not exist
```

Additionally, it is now possible to specify custom options in your custom transport:

```typescript
const customTransport: transportFunctionType<{ myCustomOption: string }> = (
	props,
) => {
	// ...
}
```

## [5.2.2] - 21-10-2024

- Reverting to the old merge config function

## [5.2.1] - 18-10-2024

- Minor bugfix

## [5.2.0] - 17-10-2024

- Ensures JSON.stringify print nested objects correctly (issue #97)
- Only merge non undefined config values (pr #105 by @SYoder1)
- Correct README for Sentry logging (pr #104 by @ssorallen)
- Add crashlytics transport (pr #91 by @chad-aijinet)
- Added fileNameDateType option to the file transport for selecting the date format
- Minor bugfix

## [5.1.0] - 26-01-2024

- Ensures JSON.stringify correctly (Thanks @iago-f-s-e)
- Added formatFunc option (Thanks @chmac)
- Added ability to set errorLevels on sentry transport
- Correct format function type name in default stringify func
- Added the confg option fixedExtLvlLength, allowing for uniform extension and level lengths by adding spaces, ensuring aligned logs
- Minor bugfix

## [5.0.1] - 04-07-2022

- Fixed fileName in fileAsyncTranport
- in fileName now you can pass {date-today}

## [5.0.0] - 30-06-2022

- Simplified init configuration (thanks to @Harjot1Singh)
- Added levels typing
- Customizable stringify function
- Transport config option now accept array of transports
- fileAsyncTransport can be configured to create a new file everyday
- customizable console.log function in consoleTrasport
- Added patchConsole method
- dateFormat now accept a custom function

#### BREAKING CHANGES

There are no real breaking changes in this version, only the default async function has been changed, which is now a simple setTimeout to 0 ms.

## [4.0.1] - 15-01-2022

- enable() and disable() methods can now enable or disable extensions

## [4.0.0] - 03-01-2022

In this new major update many of the features requested in the previous issues have been fixed, introduced or improved:

- reversed the extension mechanism, now if they are not specified, they will all be displayed
- added the ability to choose the colors of the levels for the consoleTransport
- added the ability to choose the colors of extensions in consoleTransport
- added a transport that prints logs with the native console methods (log, info, error, etc ...)
- fixed type exports
- minor bugfix

#### BREAKING CHANGES

- from this version if no extensions are specified in the configuration then all are printed, otherwise only the specified ones
- the colors option for the consoleTransport must now be set with the desired colors for each level (see the readme), if not set the logs will not be colored
- removed css web color support (latest chrome versions support ansi codes)

## [3.0.4] - 04-06-2021

- queue management to avoid race conditions problems with ExpoFS
- minor bugfix

## [3.0.3] - 12-02-2021

- removed EncodingType reference on fileAsyncTransport

## [3.0.2] - 27-01-2021

- fixed web colors in console transport

## [3.0.1] - 27-01-2021

- fixed ansi colors in console transport

## [3.0.0] - 26-01-2021

This new version introduces many changes, the log management has been modified to allow the creation of namespaced loggers and to simplify the creation of custom transports.
The creation of namespaced loggers is done via the "extend" function on the main logger. This makes it possible to enable or disable logging only for certain parts of the app. The extend function is for now only enabled at the first level, it is not possible to extend an already extended logger in order to avoid loops in the controls that would affect performance.

- complete refactoring
- added namespaced logs via extend function!
- expofs support for file transport (beta)
- sentry transport
- logs concatenation on single line
- bugfix

#### BREAKING CHANGES

To upgrade to version 3 you need to change the logger creation. The default transports have now been reduced, but they support the same functions as before but through options, e.g. to get asynchronous logs you can set the async:true option instead of importing a special transport.
Custom transports also need to change, they now receive a single "props" parameter containing everything you need, the message formatting has been moved out of the transport so you can just output it. It is still possible to format the logs at will. Please refer to the new documentation for details.

## [2.2.1] - 23-05-2020

- added "ansiColorConsoleSync" transport to color logs on terminal (and VScode terminal)

## [2.2.0] - 11-05-2020

- added log messages concatenation "log(msg1,msg2,etc...)"
- added dataFormat transportOptions (thanks @baldur)
- bugfix

## [2.1.2] - 14-04-2020

- fixed bug RNFS wrong require line (thanks @jbreuer95)

## [2.1.0] - 08-04-2020

- added possibility to pass options to transport with transportOptions property

## [2.0.2] - 13-03-2020

- bugfix

## [2.0.1] - 04-03-2020

- remove transport export from main index module to avoid require errors

## [2.0.0] - 23-02-2020

- added preset file transport based on react-native-fs
- added preset transport with react-native AfterInteractions
- bugfix

### Breaking Changes

- removed parameter cb() from transport functions
- preset transport renamed

## [1.0.2] - 12-07-2020

- bugfix

## [1.0.1] - 12-07-2020

- npm release

## [1.0.0] - 12-07-2020

- initial commit
