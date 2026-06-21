import io
import os
import base64
from PIL import Image
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import PydanticOutputParser, StrOutputParser
from langchain_core.messages import HumanMessage, SystemMessage
from .factory import get_llm_model
from .schemas import LLMConfig, GenerationRequest

class LLMService:
    def __init__(self, config: LLMConfig):
        self.config = config
        self.llm = get_llm_model(config)

    def generate(self, request: GenerationRequest):
        """
        Generates a response handling System prompts, User prompts,
        and Structured Output (Pydantic).
        """
        
        # 1. Create the Prompt Template base
        messages = [
            ("system", request.system_prompt),
            ("user", "{input}"),
        ]
        
        # 2. Handle Structured Output vs Plain Text
        if request.output_schema:
            return self._generate_structured(messages, request)
        else:
            return self._generate_text(messages, request)

    def _generate_text(self, messages, request):
        """
        Handles standard text generation.
        When request.image_path is set, builds a multimodal HumanMessage
        (text + base64 image) and invokes the LLM directly.
        """
        user_text = request.user_prompt or "Complete the task as specified."

        if request.image_path:
            if not os.path.exists(request.image_path):
                raise FileNotFoundError(f"Image not found: {request.image_path}")
            ext = os.path.splitext(request.image_path)[1].lower().lstrip(".")
            mime_map = {"jpg": "jpeg", "jpeg": "jpeg", "png": "png", "webp": "webp", "gif": "gif"}
            mime = f"image/{mime_map.get(ext, 'jpeg')}"
            MAX_VISION_PX = 1024
            with Image.open(request.image_path) as img:
                img.thumbnail((MAX_VISION_PX, MAX_VISION_PX), Image.LANCZOS)
                buf = io.BytesIO()
                save_fmt = "JPEG" if mime == "image/jpeg" else "PNG"
                img.save(buf, format=save_fmt, quality=85)
                image_data = base64.b64encode(buf.getvalue()).decode("utf-8")
            msgs = [
                SystemMessage(content=messages[0][1]),
                HumanMessage(content=[
                    {"type": "text", "text": user_text},
                    {"type": "image_url", "image_url": {"url": f"data:{mime};base64,{image_data}"}}
                ])
            ]
            response = self.llm.invoke(msgs)
            return response.content

        # Text-only: invoke directly to avoid ChatPromptTemplate misreading
        # injected JSON keys like {"face_shape": ...} as template variables.
        msgs = [
            SystemMessage(content=messages[0][1]),
            HumanMessage(content=user_text),
        ]
        response = self.llm.invoke(msgs)
        content = response.content

        # SAFETY: Gemini Flash Preview sometimes returns a list of dicts
        if isinstance(content, list):
            for part in content:
                if isinstance(part, dict) and 'text' in part:
                    return part['text']

        return content

    def _generate_structured(self, messages, request):
        """
        Handles logic for returning JSON/Pydantic objects.
        Strategies:
        1. OpenAI/Gemini: Use native .with_structured_output()
        2. HuggingFace: Use PydanticOutputParser + Format Instructions
        """
        # Note: Gemini 1.5+ and GPT-4o support native structured output
        is_advanced_model = self.config.provider.lower() in ["openai", "gemini"]

        if is_advanced_model:
            # STRATEGY A: Native Tool Calling (Best for GPT/Gemini)
            prompt = ChatPromptTemplate.from_messages(messages)
            structured_llm = self.llm.with_structured_output(request.output_schema)
            chain = prompt | structured_llm
            return chain.invoke({"input": request.user_prompt or "Complete the task as specified."})
        
        else:
            # STRATEGY B: Parsing via Prompt Engineering (Best for HF/OpenSource)
            parser = PydanticOutputParser(pydantic_object=request.output_schema)
            
            # Inject instructions into the prompt so the model knows the JSON schema
            format_instructions = parser.get_format_instructions()
            
            # Update system prompt with format instructions
            messages[0] = ("system", f"{request.system_prompt}\n\n{format_instructions}")
            
            prompt = ChatPromptTemplate.from_messages(messages)
            chain = prompt | self.llm | parser
            return chain.invoke({"input": request.user_prompt or "Complete the task as specified."})