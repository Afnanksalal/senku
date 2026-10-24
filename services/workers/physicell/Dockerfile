FROM python:3.11-slim-bookworm@sha256:f06d01d4ba3f8ad5af45a3ec87df19c1d317d8e8961edc0fabda61811af6f7cf AS build
RUN apt-get update && apt-get install -y --no-install-recommends build-essential git ca-certificates && rm -rf /var/lib/apt/lists/*
RUN git clone https://github.com/MathCancer/PhysiCell.git /opt/physicell && cd /opt/physicell && git checkout dbd3499250141b27600e91e501c54c46f68f2763 && make template && make -j2
FROM python:3.11-slim-bookworm@sha256:f06d01d4ba3f8ad5af45a3ec87df19c1d317d8e8961edc0fabda61811af6f7cf
RUN apt-get update && apt-get install -y --no-install-recommends libgomp1 libstdc++6 && rm -rf /var/lib/apt/lists/* && groupadd --gid 10001 worker && useradd --uid 10001 --gid worker --no-create-home worker
COPY --from=build /opt/physicell /opt/physicell
WORKDIR /worker
COPY services/workers/health.py ./health.py
ENV ENGINE=physicell PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 HOME=/tmp
USER 10001:10001
CMD ["python", "health.py"]
