import logging
import os
from logging.handlers import RotatingFileHandler


class Logger:
    _instance = None

    def __init__(self, log_file="logs/app.log"):
        os.makedirs("logs", exist_ok=True)
        self.logger = logging.getLogger("agentic_workflows")
        if not self.logger.handlers:
            self.logger.setLevel(logging.DEBUG)
            fmt = logging.Formatter("%(asctime)s [%(levelname)s] %(message)s")

            fh = RotatingFileHandler(log_file, maxBytes=10 * 1024 * 1024, backupCount=5, encoding="utf-8")
            fh.setFormatter(fmt)
            self.logger.addHandler(fh)

            ch = logging.StreamHandler()
            ch.setFormatter(fmt)
            self.logger.addHandler(ch)


def get_logger() -> logging.Logger:
    if Logger._instance is None:
        Logger._instance = Logger()
    return Logger._instance.logger
