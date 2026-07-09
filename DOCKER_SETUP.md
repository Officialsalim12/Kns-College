# Docker Setup Guide for KNS College Website

This guide provides step-by-step instructions for dockerizing the KNS College website application. It's intended for any developer who needs to build, run, debug, or deploy this application using Docker.

---

## Prerequisites

Before you begin, ensure you have the following installed:

- **Docker Desktop** (Windows/Mac) or **Docker Engine** (Linux)
  - Download from: https://www.docker.com/products/docker-desktop
- **Git** (for cloning the repository)
- A text editor (VS Code recommended)

---

## Step 1: Prepare Environment Variables

### 1.1 Create Environment File

Create a `.env` file in the project root directory with the following variables:

**For Docker deployment, modify `DATABASE_URL` to use `host.docker.internal`:**

```env
# Database Configuration (Docker - use host.docker.internal)
DATABASE_URL=postgresql://username:password@host.docker.internal:port/database_name

# For local development (non-Docker), use localhost:
# DATABASE_URL=postgresql://username:password@localhost:port/database_name

# Monime Payment Configuration
MONIME_ACCESS_TOKEN=your_monime_access_token
MONIME_SPACE_ID=your_monime_space_id
MONIME_API_BASE_URL=https://api.monime.io
MONIME_VERSION=caph.2025-08-23
MONIME_REQUIRE_LIVE_TOKEN=false

# Brevo Email Configuration
BREVO_API_KEY=your_brevo_api_key
BREVO_FROM_EMAIL=noreply@kns.edu.sl
BREVO_FROM_NAME=KNS College
BREVO_SCHOLARSHIP_EMAIL=admissions@kns.edu.sl

# Admin Security
KNS_ADMIN_API_KEY=your_secure_admin_api_key

# Application Settings
NODE_ENV=production
PORT=3000
```

> ⚠️ **Never commit `.env` or `.env.local` to version control.** Make sure they're listed in `.gitignore` before your first commit.

### 1.2 Environment Variable Details

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (Supabase or your own PostgreSQL) |
| `MONIME_ACCESS_TOKEN` | Your Monime payment API access token |
| `MONIME_SPACE_ID` | Your Monime space ID |
| `BREVO_API_KEY` | Brevo email service API key |
| `KNS_ADMIN_API_KEY` | Secure key for admin API endpoints |

---

## Step 2: Build the Docker Image

### 2.1 Using Docker Compose (Recommended)

Navigate to the project directory:

```bash
cd "c:\Users\admin\Desktop\Software Development Projects\College Web - KNS"
```

Build the image:

```bash
docker-compose build
```

### 2.2 Using Docker Build Directly

```bash
docker build -t kns-college-website:latest .
```

---

## Step 3: Run the Application

### 3.1 Using Docker Compose (Recommended)

```bash
docker-compose up -d
```

This will:
- Build the image (if not already built)
- Start the container in detached mode
- Map port 3000 on the host to port 3000 in the container
- Load environment variables from your `.env` file
- Create a `logs` directory for persistent logging

### 3.2 Using Docker Run Directly

```bash
docker run -d \
  --name kns-college-app \
  -p 3000:3000 \
  --env-file .env \
  -v "$(pwd)/logs:/app/logs" \
  kns-college-website:latest
```

---

## Step 4: Verify Deployment

### 4.1 Check Container Status

```bash
docker-compose ps
```

or

```bash
docker ps
```

### 4.2 Check Application Health

- **Health check**: http://localhost:3000/api/health
- **Application**: http://localhost:3000

### 4.3 View Logs

```bash
docker-compose logs -f
```

or

```bash
docker logs -f kns-college-app
```

---

## Step 5: Database Setup

```bash
# Run migrations
docker-compose exec kns-app npm run db:migrate

# Seed initial data
docker-compose exec kns-app npm run db:seed

# Or run both in one step
docker-compose exec kns-app npm run db:setup
```

---

## Step 6: Common Docker Commands

| Action | Command |
|---|---|
| Stop the app | `docker-compose stop` |
| Start the app | `docker-compose start` |
| Restart the app | `docker-compose restart` |
| Stop and remove containers | `docker-compose down` |
| Rebuild after code changes | `docker-compose up -d --build` |
| View live logs | `docker-compose logs -f kns-app` |
| Open a shell inside the container | `docker-compose exec kns-app sh` |

---

## Step 7: Production Deployment

### 7.1 Push to a Docker Registry

```bash
docker build -t your-registry/kns-college-website:latest .
docker push your-registry/kns-college-website:latest
```

> Replace `your-registry` with your actual Docker Hub username or registry path — it's a placeholder, not a literal value.

### 7.2 Deploy to Cloud Platforms

**Docker Hub / Docker Cloud**
1. Push your image to Docker Hub.
2. Use Docker Cloud or your cloud provider's Docker integration.

**Render** *(current deployment target for this project)*
Render can build directly from the GitHub repo's Dockerfile — no manual registry push required.
1. In the Render dashboard: **New +** → **Web Service**.
2. Connect the GitHub repository and branch.
3. Confirm Render detects the `Dockerfile` and sets **Environment: Docker**.
4. Add all environment variables from Step 1 under the service's **Environment** tab.
5. Deploy — Render builds and redeploys automatically on every push to the connected branch.
6. Render assigns the `PORT` env var at runtime; the app already reads `PORT` correctly.

**AWS ECS**
```bash
aws ecs register-task-definition --cli-input-json file://task-definition.json
aws ecs update-service --cluster your-cluster --service your-service --task-definition your-task
```

**Google Cloud Run**
```bash
gcloud run deploy kns-college \
  --image gcr.io/your-project/kns-college-website:latest \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```

**Azure Container Instances**
```bash
az container create \
  --resource-group myResourceGroup \
  --name kns-college-app \
  --image your-registry/kns-college-website:latest \
  --dns-name-label kns-college-app \
  --ports 3000
```

---

## Troubleshooting

### Docker Desktop Connection Issues

If you see "The system cannot find the file specified" or Docker pipe errors:

1. **Start Docker Desktop** and wait for the tray icon to stabilize.
2. **Restart Docker Desktop** via the tray icon if issues persist.
3. **Reset Docker Desktop** (Settings → Troubleshoot → Reset to factory defaults) as a last resort.
4. **Check the Docker service** (Windows):
   ```powershell
   Get-Service docker
   Start-Service docker
   ```

### Container Won't Start

1. Check logs: `docker-compose logs`
2. Verify environment variables in `.env`
3. Ensure port 3000 isn't already in use
4. Confirm Docker Desktop is running

### Database Connection Issues

1. Verify `DATABASE_URL` is correct
2. Ensure the database is reachable from inside the container
3. Check network connectivity
4. Hit the health check: `http://localhost:3000/api/health`

### Healthcheck Stuck on "starting" or "unhealthy"

If `docker-compose ps` shows `health: starting` indefinitely or flips to `unhealthy`:

- Inspect the healthcheck log directly:
  ```powershell
  docker inspect kns-college-app --format="{{json .State.Health}}"
  ```
- A common cause on Alpine-based Node images: the `HEALTHCHECK` command in the Dockerfile uses `http://localhost:3000/...`, which can resolve to the IPv6 loopback (`::1`) inside the container and fail with `ECONNREFUSED`. Fix by using `127.0.0.1` explicitly:
  ```dockerfile
  HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://127.0.0.1:3000/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"
  ```
- After editing the Dockerfile, do a **full rebuild** (not just `up -d`) so the new instruction is baked into the image:
  ```powershell
  docker-compose down
  docker-compose build --no-cache
  docker-compose up -d
  ```
- Confirm the fix landed in the built image before troubleshooting further:
  ```powershell
  docker inspect kns-college-app --format="{{json .Config.Healthcheck}}"
  ```

### Build Failures

1. Clear the Docker cache: `docker system prune -a`
2. Check `package.json` is valid
3. Ensure all dependencies are listed
4. Verify Node.js version compatibility

### Permission Issues

1. On Linux/Mac, ensure proper file permissions
2. Use the `USER` instruction in the Dockerfile if needed
3. Check volume mount permissions

---

## Security Best Practices

### Environment Variables

- **Never** commit `.env` or `.env.local` files to version control.
- Use secrets management in production (AWS Secrets Manager, Azure Key Vault, or your platform's built-in env var storage — e.g. Render's Environment tab).
- Rotate API keys and tokens regularly, and immediately if a file containing them is ever accidentally committed or pushed.
- If a secrets file is committed by mistake:
  ```bash
  git rm --cached .env.local
  echo ".env.local" >> .gitignore
  git commit -m "Remove .env.local from tracking"
  git push
  ```
  Note this does **not** remove it from Git history. If it was ever pushed to a remote, treat all included credentials as compromised and rotate them, and consider scrubbing history with `git filter-repo` if needed.

### Image Security

- Use specific version tags instead of `latest` for production images.
- Regularly update the base image: `docker pull node:18-alpine`
- Scan images for vulnerabilities: `docker scan kns-college-website:latest`

### Network Security

- Use Docker networks for container isolation.
- Don't expose unnecessary ports.
- Implement firewall rules where applicable.

### Resource Limits

Add resource limits to `docker-compose.yml`:

```yaml
services:
  kns-app:
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 512M
        reservations:
          cpus: '0.5'
          memory: 256M
```

---

## Monitoring and Maintenance

### Health Monitoring

The application includes a built-in health check at `/api/health`. Monitor this endpoint to confirm the application is running correctly, both locally and in production.

### Log Management

Logs are stored in the `./logs` directory. Set up log rotation in production, e.g.:

```bash
sudo apt-get install logrotate
sudo nano /etc/logrotate.d/kns-college
```

### Backup Strategy

- Regular database backups
- Backup environment configurations securely (not in Git)
- Version control for application code
- Tag and version container images for rollback capability

---

## Additional Resources

- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Node.js Docker Best Practices](https://github.com/nodejs/docker-node/blob/main/docs/BestPractices.md)
- [PostgreSQL in Docker](https://hub.docker.com/_/postgres)

---

## Support

**Application issues:**
1. Check application logs: `docker-compose logs`
2. Verify environment configuration
3. Test database connectivity
4. Review the `/api/health` endpoint

**Docker-related issues:**
- Consult Docker documentation
- Check Docker Desktop logs
- Verify the Docker daemon is running