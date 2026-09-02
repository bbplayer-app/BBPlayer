FROM debian:bookworm AS bsdiff
ARG BSDIFF_COMMIT=391fd2b6d66eecebeefa80ee2f199c22ea0e8539
RUN apt-get update && apt-get install -y --no-install-recommends git build-essential libbrotli-dev libdivsufsort-dev libbz2-dev ca-certificates && rm -rf /var/lib/apt/lists/*
RUN git clone https://github.com/expo/bsdiff.git /work/bsdiff && cd /work/bsdiff && git checkout "$BSDIFF_COMMIT" && make
# Keep the binary format compatibility assertion in the image build itself:
# Expo clients require legacy BSDIFF40 (bzip2), and bspatch must restore the
# exact target bytes before this image can be published.
RUN printf 'old Hermes fixture\n' >/work/old.hbc && printf 'new Hermes fixture with a change\n' >/work/new.hbc \
 && /work/bsdiff/bsdiff --format=bsdiff40 /work/old.hbc /work/new.hbc /work/patch \
 && test "$(head -c 8 /work/patch)" = BSDIFF40 \
 && /work/bsdiff/bspatch /work/old.hbc /work/restored.hbc /work/patch \
 && cmp /work/new.hbc /work/restored.hbc

FROM golang:1.27-bookworm AS build
WORKDIR /src
COPY go.mod ./
RUN go mod download
COPY . .
RUN go test ./...
RUN CGO_ENABLED=0 go build -trimpath -ldflags='-s -w' -o /out/bbplayer-updates ./cmd/bbplayer-updates

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends libbrotli1 libdivsufsort3 libbz2-1.0 ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=bsdiff /work/bsdiff/bsdiff /usr/local/bin/bsdiff
COPY --from=bsdiff /work/bsdiff/bspatch /usr/local/bin/bspatch
COPY --from=build /out/bbplayer-updates /usr/local/bin/bbplayer-updates
USER 65532:65532
ENTRYPOINT ["bbplayer-updates"]
