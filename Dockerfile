FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
# Hugging Face Spaces si aspetta l'app sulla porta 7860
ENV PORT=7860
EXPOSE 7860
CMD ["npm", "start"]
