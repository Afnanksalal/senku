FROM python:3.11-slim-bookworm@sha256:f06d01d4ba3f8ad5af45a3ec87df19c1d317d8e8961edc0fabda61811af6f7cf AS numerical-runtime
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 HOME=/tmp
RUN groupadd --gid 10001 worker && useradd --uid 10001 --gid worker --no-create-home worker
WORKDIR /worker
COPY services/workers/numerics/requirements.lock /worker/requirements.lock
RUN pip install --no-cache-dir --require-hashes -r requirements.lock

FROM python:3.11-slim-bookworm@sha256:f06d01d4ba3f8ad5af45a3ec87df19c1d317d8e8961edc0fabda61811af6f7cf
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 HOME=/tmp
RUN groupadd --gid 10001 worker && useradd --uid 10001 --gid worker --no-create-home worker
WORKDIR /worker
COPY services/workers/rdkit/requirements.lock /worker/requirements.lock
RUN pip install --no-cache-dir --require-hashes -r requirements.lock
RUN apt-get update && apt-get install -y --no-install-recommends libexpat1 libgomp1 && rm -rf /var/lib/apt/lists/*
COPY --from=numerical-runtime /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY services/workers/docking/requirements.lock /worker/docking-requirements.lock
RUN pip install --no-cache-dir --require-hashes -r docking-requirements.lock
ENV OPENBLAS_NUM_THREADS=1 OMP_NUM_THREADS=1 MKL_NUM_THREADS=1
COPY services/workers/docking /worker/docking
RUN python docking/prepare.py
COPY services/workers/health.py services/workers/execute.py /worker/
ENV ENGINE=vina
USER 10001:10001
EXPOSE 8080
CMD ["python", "health.py"]
