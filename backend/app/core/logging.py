"""Uygulama günlükleri: zaman, düzey ve kaynak adıyla standart hataya yazılır.

Yalnızca "app" altındaki günlükçüler yapılandırılır; kök günlükçü değiştirilmez, böylece SQLAlchemy gibi
kütüphaneler kendi varsayılan düzeylerinde kalır. Düzey LOG_LEVEL ortam değişkeninden okunur (varsayılan INFO).
"""

import logging
import os

LOG_FORMAT = "%(asctime)s %(levelname)s %(name)s: %(message)s"
HANDLER_NAME = "app-stderr"


def configure_logging() -> None:
    logger = logging.getLogger("app")
    level_name = os.getenv("LOG_LEVEL", "INFO").upper()
    level = logging.getLevelNamesMapping().get(level_name, logging.INFO)
    logger.setLevel(level)
    # Tekrar çağrıldığında (ör. testlerde) ikinci bir işleyici eklenmez.
    if any(handler.get_name() == HANDLER_NAME for handler in logger.handlers):
        return
    handler = logging.StreamHandler()
    handler.set_name(HANDLER_NAME)
    handler.setFormatter(logging.Formatter(LOG_FORMAT))
    logger.addHandler(handler)
