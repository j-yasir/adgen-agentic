from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str

    # kie.ai — single key for chat models + media generation
    KIE_API_KEY: str = ""

    # Google AI
    GOOGLE_API_KEY: str = ""

    # ElevenLabs
    ELEVENLABS_API_KEY: str = ""

    # Firecrawl
    FIRECRAWL_API_KEY: str = ""

    # Cloudflare R2
    R2_ACCOUNT_ID: str = ""
    R2_ACCESS_KEY_ID: str = ""
    R2_SECRET_ACCESS_KEY: str = ""
    R2_BUCKET_NAME: str = ""
    R2_PUBLIC_URL: str = ""

    # JWT
    JWT_SECRET_KEY: str = "change-me-in-production"
    JWT_REFRESH_SECRET_KEY: str = "change-me-refresh-in-production"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # App
    APP_ENV: str = "development"
    LOG_LEVEL: str = "INFO"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
