package expo.modules.orpheus.model

import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record

class AbLoopRange : Record {
    @Field var start: Double = Double.NaN
    @Field var end: Double = Double.NaN
}
