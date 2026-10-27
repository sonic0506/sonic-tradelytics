// 선택 목록(Select) 응답은 { value, label }로 통일해요. value는 등록·수정 API에 그대로 넘기는 식별값이에요.
export class OptionDto {
  value: string;
  label: string;

  static of(value: string, label: string): OptionDto {
    const option = new OptionDto();
    option.value = value;
    option.label = label;
    return option;
  }
}
