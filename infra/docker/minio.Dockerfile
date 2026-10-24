FROM golang:1.24-bookworm@sha256:1a6d4452c65dea36aac2e2d606b01b4a029ec90cc1ae53890540ce6173ea77ac AS build
WORKDIR /src
RUN git clone https://github.com/minio/minio.git . && git checkout 07c3a429bfed433e49018cb0f78a52145d4bedeb && go build -o /minio .
FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl && rm -rf /var/lib/apt/lists/* && useradd --uid 10001 --create-home minio && mkdir /data && chown minio /data
COPY --from=build /minio /usr/local/bin/minio
COPY --from=build /src/LICENSE /usr/share/licenses/minio/LICENSE
USER 10001
ENTRYPOINT ["minio"]
