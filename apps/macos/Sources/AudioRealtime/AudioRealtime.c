#include "AudioRealtime.h"
#include <stdlib.h>
#include <stdatomic.h>
#define CAPACITY 16384
struct BBPCM {
    _Atomic uint32_t references;
    float values[CAPACITY];
    _Atomic uint32_t read;
    _Atomic uint32_t write;
    _Atomic uint64_t frames;
    _Atomic bool enabled;
    _Atomic bool float32;
};
BBPCM *bb_pcm_create(void) {
    BBPCM *b = calloc(1, sizeof(BBPCM));
    if (b) atomic_store(&b->references, 1);
    return b;
}
void bb_pcm_retain(BBPCM *b) { atomic_fetch_add_explicit(&b->references, 1, memory_order_relaxed); }
void bb_pcm_destroy(BBPCM *b) {
    if (b && atomic_fetch_sub_explicit(&b->references, 1, memory_order_acq_rel) == 1) free(b);
}
void bb_pcm_enable(BBPCM *b, bool enabled) { atomic_store(&b->enabled, enabled); }
void bb_pcm_set_format(BBPCM *b, bool float32) { atomic_store(&b->float32, float32); }
void bb_pcm_push(BBPCM *b, const float *samples, size_t frames, size_t stride) {
    if (!b || !samples || !stride || !atomic_load_explicit(&b->float32, memory_order_relaxed)) return;
    atomic_fetch_add_explicit(&b->frames, frames, memory_order_relaxed);
    if (!atomic_load_explicit(&b->enabled, memory_order_relaxed)) return;
    uint32_t w = atomic_load_explicit(&b->write, memory_order_relaxed);
    uint32_t r = atomic_load_explicit(&b->read, memory_order_acquire);
    size_t free_count = CAPACITY - 1 - ((w - r) & (CAPACITY - 1));
    if (frames > free_count) frames = free_count;
    for (size_t i = 0; i < frames; i++) b->values[(w + i) & (CAPACITY - 1)] = samples[i * stride];
    atomic_store_explicit(&b->write, (w + (uint32_t)frames) & (CAPACITY - 1), memory_order_release);
}
size_t bb_pcm_read(BBPCM *b, float *destination, size_t count) {
    uint32_t r = atomic_load_explicit(&b->read, memory_order_relaxed);
    uint32_t w = atomic_load_explicit(&b->write, memory_order_acquire);
    size_t available = (w - r) & (CAPACITY - 1);
    if (count > available) count = available;
    else r = (w - (uint32_t)count) & (CAPACITY - 1);
    for (size_t i = 0; i < count; i++) destination[i] = b->values[(r + i) & (CAPACITY - 1)];
    atomic_store_explicit(&b->read, (r + (uint32_t)count) & (CAPACITY - 1), memory_order_release);
    return count;
}
uint64_t bb_pcm_frames(BBPCM *b) { return atomic_load_explicit(&b->frames, memory_order_relaxed); }
