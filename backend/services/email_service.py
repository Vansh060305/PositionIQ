# Sends email over SMTP. Isolated here so no other file needs to know
# about smtplib - swapping to a transactional email API later (SendGrid,
# Resend) only means changing this one file.

import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from core.config import settings

logger = logging.getLogger(__name__)


def send_email(to_email: str, subject: str, html_body: str) -> bool:
    if not settings.smtp_host or not settings.smtp_username:
        # Not configured yet - log and move on instead of crashing whatever
        # called this (matches how a missing Finnhub key is handled)
        logger.warning("SMTP not configured - skipping email send to %s", to_email)
        return False

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = settings.smtp_from_email or settings.smtp_username
    msg["To"] = to_email
    msg.attach(MIMEText(html_body, "html"))

    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as server:
            server.starttls()
            server.login(settings.smtp_username, settings.smtp_password)
            server.sendmail(msg["From"], [to_email], msg.as_string())
        return True
    except Exception as e:
        logger.error("Failed to send email to %s: %s", to_email, e)
        return False
