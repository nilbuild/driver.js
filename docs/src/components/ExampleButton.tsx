type ExampleButtonProps = {
  id: string;
  onClick: () => void;
  text: string;
};

export function ExampleButton(props: ExampleButtonProps) {
  const { id, onClick, text } = props;

  return (
    <button
      id={id}
      onClick={onClick}
      className="cursor-pointer rounded-xl border-2 border-black bg-white px-4 py-2 font-medium text-black md:text-base lg:text-lg shadow-[3px_3px_0_0_#000] transition-all duration-100 hover:bg-yellow-300 active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0_0_#000] focus:outline-none focus-visible:outline-none">
      { text }
    </button>
  );
}