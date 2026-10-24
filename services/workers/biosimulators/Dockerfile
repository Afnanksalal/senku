FROM python:3.11-slim-bookworm@sha256:f06d01d4ba3f8ad5af45a3ec87df19c1d317d8e8961edc0fabda61811af6f7cf
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 HOME=/tmp
RUN groupadd --gid 10001 worker && useradd --uid 10001 --gid worker --no-create-home worker
WORKDIR /worker
COPY services/workers/biosimulators/requirements.lock /worker/requirements.lock
RUN pip install --no-cache-dir --require-hashes -r requirements.lock
RUN apt-get update && apt-get install -y --no-install-recommends libexpat1 libgomp1 && rm -rf /var/lib/apt/lists/*
COPY services/workers/health.py services/workers/execute.py /worker/
ENV ENGINE=biosimulators
USER 10001:10001
EXPOSE 8080
CMD ["python", "health.py"]
