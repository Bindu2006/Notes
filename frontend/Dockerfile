FROM node:20-alpine

WORKDIR /app

# Copy dependency mappings and install them
COPY package*.json ./
RUN npm install

# Copy application files
COPY . .

# Expose Vite development port
EXPOSE 5173

# Start Vite server binding to all network interfaces for Docker access
CMD ["npm", "run", "dev", "--", "--host"]
