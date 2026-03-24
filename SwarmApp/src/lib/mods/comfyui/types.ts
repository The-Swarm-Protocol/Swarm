/** ComfyUI API — Type definitions */

export interface ComfyUIPromptResponse {
  prompt_id: string;
  number: number;
}

export interface ComfyUIHistoryEntry {
  prompt: unknown[];
  outputs: Record<
    string,
    {
      images?: {
        filename: string;
        subfolder: string;
        type: string;
      }[];
    }
  >;
  status: {
    status_str: string;
    completed: boolean;
  };
}
