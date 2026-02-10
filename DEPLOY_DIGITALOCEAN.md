# MediSeen HMS - DigitalOcean Deployment Guide

## Option 1: App Platform (Recommended - Easiest)

### Step 1: Create Managed PostgreSQL Database

1. Go to DigitalOcean Console → Databases
2. Click "Create Database Cluster"
3. Choose:
   - **Engine:** PostgreSQL 15
   - **Region:** London (closest to you)
   - **Plan:** Basic ($15/mo) or Production ($50/mo)
   - **Name:** `mediseen-db`
4. Click "Create Database Cluster"
5. Wait ~5 minutes for provisioning
6. Go to "Connection Details" → Copy the connection string

### Step 2: Deploy Backend to App Platform

1. Go to DigitalOcean Console → Apps
2. Click "Create App"
3. Choose source:
   - **GitHub** → Connect your GitHub account
   - Select `XeniaXi/Mediseen-hms-v2` repo
   - Source Directory: `/backend`
   - Branch: `main`
4. Configure component:
   - **Type:** Web Service
   - **Name:** `mediseen-api`
   - **Run Command:** `npm run start`
   - **Build Command:** `npm ci && npm run build`
   - **HTTP Port:** 8080
5. Add Environment Variables:
   ```
   NODE_ENV=production
   PORT=8080
   DATABASE_URL=<paste from Step 1>
   JWT_SECRET=<generate: openssl rand -base64 64>
   JWT_REFRESH_SECRET=<generate: openssl rand -base64 64>
   CORS_ORIGIN=https://mediseenhms.com,https://www.mediseenhms.com,https://mediseen-hms.vercel.app
   ```
6. Choose plan: Basic ($5/mo)
7. Click "Create Resources"

### Step 3: Configure Domain

1. In your App → Settings → Domains
2. Add custom domain: `api.mediseenhms.com`
3. Add the CNAME record to your DNS:
   ```
   Type: CNAME
   Name: api
   Value: <your-app>.ondigitalocean.app
   ```

### Step 4: Run Database Migrations

After first deploy, open Console in App Platform:
```bash
npx prisma db push
npm run seed  # Optional: add demo data
```

---

## Option 2: Droplet (More Control)

### Step 1: Create Droplet

1. Go to DigitalOcean → Droplets → Create
2. Choose:
   - **Image:** Ubuntu 22.04 LTS
   - **Plan:** Basic $12/mo (2GB RAM, 1 CPU)
   - **Region:** London
   - **Auth:** SSH Key (recommended)
3. Create and note the IP address

### Step 2: Initial Server Setup

SSH into your droplet:
```bash
ssh root@YOUR_DROPLET_IP

# Update system
apt update && apt upgrade -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Install PostgreSQL
apt install -y postgresql postgresql-contrib

# Install Nginx
apt install -y nginx

# Install PM2 (process manager)
npm install -g pm2

# Create app user
adduser --disabled-password mediseen
```

### Step 3: Setup PostgreSQL

```bash
sudo -u postgres psql

CREATE DATABASE mediseen_hms;
CREATE USER mediseen WITH ENCRYPTED PASSWORD 'YOUR_SECURE_PASSWORD';
GRANT ALL PRIVILEGES ON DATABASE mediseen_hms TO mediseen;
\q
```

### Step 4: Deploy Application

```bash
# Switch to app user
su - mediseen
cd ~

# Clone repo
git clone https://github.com/XeniaXi/Mediseen-hms-v2.git
cd Mediseen-hms-v2/backend

# Install dependencies
npm ci

# Create .env file
cat > .env << EOF
NODE_ENV=production
PORT=8080
DATABASE_URL="postgresql://mediseen:YOUR_SECURE_PASSWORD@localhost:5432/mediseen_hms"
JWT_SECRET="$(openssl rand -base64 64)"
JWT_REFRESH_SECRET="$(openssl rand -base64 64)"
CORS_ORIGIN="https://mediseenhms.com,https://www.mediseenhms.com,https://mediseen-hms.vercel.app"
EOF

# Build
npm run build

# Run migrations
npx prisma db push

# Seed database (optional)
npm run seed

# Start with PM2
pm2 start dist/index.js --name mediseen-api
pm2 save
pm2 startup
```

### Step 5: Configure Nginx

```bash
# As root
cat > /etc/nginx/sites-available/mediseen << 'EOF'
server {
    listen 80;
    server_name api.mediseenhms.com;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

ln -s /etc/nginx/sites-available/mediseen /etc/nginx/sites-enabled/
nginx -t
systemctl restart nginx
```

### Step 6: Setup SSL with Let's Encrypt

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d api.mediseenhms.com
```

---

## Post-Deployment

### Test the API

```bash
# Health check
curl https://api.mediseenhms.com/health

# Test auth
curl -X POST https://api.mediseenhms.com/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "superadmin@mediseenhms.com",
    "password": "At@aries24",
    "firstName": "Sir",
    "lastName": "Sid",
    "role": "SUPER_ADMIN"
  }'
```

### Update Frontend

In the frontend `.env`:
```
REACT_APP_API_URL=https://api.mediseenhms.com/api/v1
```

---

## Costs Estimate

| Component | App Platform | Droplet |
|-----------|-------------|---------|
| API Server | $5-12/mo | $12/mo |
| PostgreSQL | $15-50/mo | Included |
| **Total** | **$20-62/mo** | **$12/mo** |

---

## Security Checklist

- [ ] Strong JWT secrets (64+ chars)
- [ ] Database password secure
- [ ] SSL/HTTPS enabled
- [ ] Firewall configured (ufw)
- [ ] Rate limiting enabled
- [ ] CORS restricted to your domains
- [ ] Regular backups enabled
