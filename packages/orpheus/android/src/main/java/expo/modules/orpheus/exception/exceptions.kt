package expo.modules.orpheus.exception

import expo.modules.kotlin.exception.CodedException

class ControllerNotInitializedException : CodedException(
    "ERR_CONTROLLER_NOT_INIT",
    "The MediaController is not initialized. Connect to service first.",
    null
)