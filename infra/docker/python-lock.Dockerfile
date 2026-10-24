FROM python:3.11-slim-bookworm@sha256:f06d01d4ba3f8ad5af45a3ec87df19c1d317d8e8961edc0fabda61811af6f7cf
RUN pip install --no-cache-dir uv==0.9.6
WORKDIR /workspace
ENTRYPOINT ["uv", "pip", "compile", "--generate-hashes", "--python-version", "3.11"]
