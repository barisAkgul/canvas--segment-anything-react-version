import {
  env,
  SamModel,
  AutoProcessor,
  RawImage,
  Tensor,
} from "@xenova/transformers";

// Web Worker context için type tanımı
const ctx: Worker = self as any;

// Since we will download the model from the Hugging Face Hub, we can skip the local model check
env.allowLocalModels = false;

// Singleton pattern for model and processor
class SegmentAnythingSingleton {
  static model_id = "Xenova/slimsam-77-uniform";
  static model: any;
  static processor: any;
  static quantized = true;

  static getInstance() {
    if (!this.model) {
      this.model = SamModel.from_pretrained(this.model_id, {
        quantized: this.quantized,
      });
    }
    if (!this.processor) {
      this.processor = AutoProcessor.from_pretrained(this.model_id);
    }

    return Promise.all([this.model, this.processor]);
  }
}

// State variables
let image_embeddings: any = null;
let image_inputs: any = null;
let ready = false;

// Message handler
ctx.onmessage = async (e: MessageEvent) => {
  const [model, processor] = await SegmentAnythingSingleton.getInstance();

  if (!ready) {
    ready = true;
    ctx.postMessage({
      type: "ready",
    });
  }

  const { type, data } = e.data;

  switch (type) {
    case "reset":
      image_inputs = null;
      image_embeddings = null;
      break;

    case "segment":
      ctx.postMessage({
        type: "segment_result",
        data: "start",
      });

      // Convert ArrayBuffer to Blob and create URL
      const blob = new Blob([data], { type: "image/jpeg" });
      const url = URL.createObjectURL(blob);

      const image = await RawImage.read(url);
      URL.revokeObjectURL(url); // Clean up the URL

      image_inputs = await processor(image);
      image_embeddings = await model.get_image_embeddings(image_inputs);

      ctx.postMessage({
        type: "segment_result",
        data: "done",
      });
      break;

    case "decode":
      const reshaped = image_inputs.reshaped_input_sizes[0];
      const points = data.map((x: any) => [
        x.point[0] * reshaped[1],
        x.point[1] * reshaped[0],
      ]);
      const labels = data.map((x: any) => BigInt(x.label));

      const input_points = new Tensor("float32", points.flat(Infinity), [
        1,
        1,
        points.length,
        2,
      ]);
      const input_labels = new Tensor("int64", labels.flat(Infinity), [
        1,
        1,
        labels.length,
      ]);

      const outputs = await model({
        ...image_embeddings,
        input_points,
        input_labels,
      });

      const masks = await processor.post_process_masks(
        outputs.pred_masks,
        image_inputs.original_sizes,
        image_inputs.reshaped_input_sizes
      );

      ctx.postMessage({
        type: "decode_result",
        data: {
          mask: RawImage.fromTensor(masks[0][0]),
          scores: outputs.iou_scores.data,
        },
      });
      break;

    default:
      throw new Error(`Unknown message type: ${type}`);
  }
};
