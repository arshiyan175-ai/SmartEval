# Image Integration Testing Playbook

## Image handling rules
- Use base64-encoded images for all image requests and tests.
- Accepted formats are JPEG, PNG, and WEBP only.
- Do not use blank, solid-color, or uniform-variance images; every test image must contain real visual features such as text, edges, textures, or shadows.
- If a source is not JPEG, PNG, or WEBP, transcode it before uploading and re-detect the MIME type.
- For animated images, extract the first frame only.
- Resize large images to reasonable bounds before sending them to the vision model.

## Validation focus
- Confirm image upload reaches the backend with the correct MIME type.
- Confirm OCR returns extracted question/answer text rather than placeholder copy.
- Confirm the AI returns valid structured grading with score, maximum marks, criterion marks, justification, answer quality, short-answer assessment, strengths, weaknesses, and improvements.
- Confirm PDF handling either extracts all supported pages or clearly reports an unsupported/failed conversion.