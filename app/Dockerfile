FROM node:18-alpine
WORKDIR /app

# Copy package.json and install dependencies
COPY package.json package-lock.json* ./
RUN npm install

# Copy the entire application
COPY . .

# Expose port
EXPOSE 3308

# Start the application
CMD ["npm", "start"]
