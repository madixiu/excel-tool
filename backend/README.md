
# Gunicorn Production run command
gunicorn main:app \
  --workers 4 \
  --worker-class uvicorn.workers.UvicornWorker \
  --bind 0.0.0.0:8000 \
  --timeout 600 \
  --max-requests 20 \
  --max-requests-jitter 5 \
  --daemon


# Gunicorn Development run command
uvicorn main:app --reload --port 8000                                                                                                                                                                                        