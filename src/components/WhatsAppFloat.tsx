import { MessageCircle } from "lucide-react";

const WhatsAppFloat = () => {
  const phoneNumber = "553898980476";
  const message = encodeURIComponent("Gostaria de Obter creditos");
  const whatsappUrl = `https://wa.me/${phoneNumber}?text=${message}`;

  return (
    <a
      href={whatsappUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-6 right-6 z-50 flex items-center justify-center w-14 h-14 bg-[#25D366] rounded-full shadow-lg hover:bg-[#20BA5C] transition-all duration-300 hover:scale-110 animate-pulse-slow"
      aria-label="Contato via WhatsApp"
    >
      <MessageCircle className="w-7 h-7 text-white fill-white" />
    </a>
  );
};

export default WhatsAppFloat;
