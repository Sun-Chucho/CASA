export {};

declare global {
  interface Window {
    orangeHotelHardware?: {
      listPrinters?: () => Promise<string[]>;
      printRaw?: (job: {
        printerName: string;
        content: string;
        openDrawer?: boolean;
      }) => Promise<{ ok: boolean; error?: string }>;
    };
  }
}
