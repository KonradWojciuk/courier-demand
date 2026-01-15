# Courier Demand Forecasting

A project for forecasting demand for courier services using a local Lakehouse architecture with MinIO, Hive Metastore, and Trino.

## Prerequisites

- [Docker](https://www.docker.com/get-started) (version 20.10 or higher)
- [Docker Compose](https://docs.docker.com/compose/install/) (version 2.0 or higher)

## Project Structure

The project consists of the following services:

- **MinIO**: Object storage (S3-compatible)
- **Hive Metastore**: Metadata management for the data lake
- **Trino**: Distributed SQL query engine
- **Converter**: Python service for data conversion and processing
- **Backend**: Node.js/Express API server
- **Frontend**: Next.js web application

## Getting Started

### 1. Clone the Repository

```bash
git clone <repository-url>
cd courier-demand
```

### 2. Launch the Project

Start all services using Docker Compose:

```bash
docker-compose up --build
```

This command will:
- Build all Docker images (including installing Node.js and Python dependencies)
- Start all services in the correct order
- Set up the network between services

### 3. Access the Application

Once all services are running, you can access:

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001
- **Trino UI**: http://localhost:8080
- **MinIO Console**: http://localhost:9001
  - Username: `minioadmin`
  - Password: `minioadmin`

### 4. Stop the Project

To stop all services:

```bash
docker-compose down
```

To stop and remove volumes (this will delete data):

```bash
docker-compose down -v
```

## Development

### Running Services Individually

If you need to run services locally for development:

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

**Backend:**
```bash
cd backend
npm install
node src/index.js
```

**Converter:**
```bash
cd converter
pip install -r requirements.txt
python converter.py
```

Note: When running services individually, ensure that MinIO, Hive Metastore, and Trino are running via Docker Compose, as they are required dependencies.

## Environment Variables

The project uses default environment variables configured in `docker-compose.yml`. For production deployments, consider updating:

- MinIO credentials
- Trino connection settings
- Service ports (if conflicts occur)

## Troubleshooting

- **Port conflicts**: If ports 3000, 3001, 8080, 9000, or 9001 are already in use, modify the port mappings in `docker-compose.yml`
- **Build issues**: Ensure Docker has enough resources allocated (memory and CPU)
- **Service health**: Check service logs with `docker-compose logs <service-name>`

## License

[Add your license information here]
