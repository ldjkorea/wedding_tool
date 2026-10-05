import { FieldRequirement } from '@/components/contract-form/FieldRequirement';
import { getFormField, isFormFieldEnabled, isFormFieldRequired } from '@/services/configuration';
import React from 'react';
import { User, Mail, Phone } from 'lucide-react';

interface CustomerInfoSectionProps {
  groomName: string;
  groomPhone: string;
  groomFamilyMembers?: string;
  brideName: string;
  bridePhone: string;
  brideFamilyMembers?: string;
  email: string;
  onChange: (fields: Partial<{
    groomName: string;
    groomPhone: string;
    groomFamilyMembers: string;
    brideName: string;
    bridePhone: string;
    brideFamilyMembers: string;
    email: string;
  }>) => void;
  errors?: Record<string, string>;
}

export const CustomerInfoSection: React.FC<CustomerInfoSectionProps> = ({
  groomName,
  groomPhone,
  groomFamilyMembers = '',
  brideName,
  bridePhone,
  brideFamilyMembers = '',
  email,
  onChange,
  errors = {},
}) => {
  return (
    <div className="space-y-6">
      <div className="border-b border-[rgb(var(--studio-surface))] pb-3">
        <h3 className="text-base sm:text-lg font-semibold text-[rgb(var(--studio-primary))] flex items-center gap-2">
          <User className="w-5 h-5 text-[rgb(var(--studio-muted))]" />
          <span>2. 고객 정보</span>
        </h3>
        <p className="text-xs sm:text-sm text-[rgb(var(--studio-muted))] mt-1 break-keep leading-relaxed">
          {isFormFieldEnabled('groomPhone') || isFormFieldEnabled('bridePhone') ? '신랑님과 신부님의 연락처 및 계약서를 받으실 이메일을' : '신랑님과 신부님의 성명 및 계약서를 받으실 이메일을'} <span className="whitespace-nowrap">입력해 주세요.</span>
        </p>
      </div>

      {/* 신랑 정보 */}
      <div className="p-4 sm:p-5 bg-[rgb(var(--studio-background))] border border-[rgb(var(--studio-border))] rounded-2xl space-y-4">
        <span className="text-xs sm:text-sm font-bold text-[rgb(var(--studio-muted))] tracking-wider uppercase flex items-center gap-1.5">
          <User className="w-4 h-4 text-[rgb(var(--studio-muted))]" />
          <span>신랑님 정보</span>
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs sm:text-sm font-semibold text-[rgb(var(--studio-primary))] mb-2">
              신랑 성명 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              placeholder="예: 김민우"
              value={groomName}
              onChange={(e) => onChange({ groomName: e.target.value })}
              className={`w-full h-12 px-3.5 bg-[#FFFFFF] border ${
                errors.groomName ? 'border-red-400 focus:ring-red-400' : 'border-[rgb(var(--studio-line))] focus:border-[rgb(var(--studio-primary))]'
              } rounded-xl text-sm sm:text-base text-[rgb(var(--studio-primary))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--studio-primary))]/10 transition-all placeholder:text-[rgb(var(--studio-muted))]/70 font-medium`}
            />
            {errors.groomName && (
              <p className="text-xs text-red-500 mt-1.5 font-medium">{errors.groomName}</p>
            )}
          </div>

          {isFormFieldEnabled('groomPhone') && (<div>
            <label htmlFor="contract-field-groomPhone" className="block text-xs sm:text-sm font-semibold text-[rgb(var(--studio-primary))] mb-2">{getFormField('groomPhone').label} <FieldRequirement field="groomPhone" /></label>
            <input
              id="contract-field-groomPhone"
              required={isFormFieldRequired('groomPhone')}
              aria-required={isFormFieldRequired('groomPhone')}
              aria-invalid={!!errors.groomPhone}
              type="tel"
              placeholder={getFormField('groomPhone').placeholder}
              value={groomPhone}
              onChange={(e) => onChange({ groomPhone: e.target.value })}
              className={`w-full h-12 px-3.5 bg-[#FFFFFF] border ${
                errors.groomPhone ? 'border-red-400 focus:ring-red-400' : 'border-[rgb(var(--studio-line))] focus:border-[rgb(var(--studio-primary))]'
              } rounded-xl text-sm sm:text-base text-[rgb(var(--studio-primary))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--studio-primary))]/10 transition-all placeholder:text-[rgb(var(--studio-muted))]/70 font-medium`}
            />
            {errors.groomPhone && (
              <p className="text-xs text-red-500 mt-1.5 font-medium">{errors.groomPhone}</p>
            )}
          </div>)}

          {/* 신랑님 직계 가족구성 */}
          {(isFormFieldEnabled('groomFamilyMembers')) && (<details
            open={(isFormFieldRequired('groomFamilyMembers') || !!(errors.groomFamilyMembers)) || undefined}
            onToggle={(event) => {
              if ((isFormFieldRequired('groomFamilyMembers') || !!(errors.groomFamilyMembers)) && !event.currentTarget.open) {
                event.currentTarget.open = true;
              }
            }}
            className="sm:col-span-2 rounded-xl border border-[rgb(var(--studio-border))] p-3"
          >
            <summary className="cursor-pointer text-sm font-semibold text-[rgb(var(--studio-body))]">{(isFormFieldRequired('groomFamilyMembers')) ? "신랑 가족사진 준비 정보 (필수 항목 포함)" : "신랑 가족사진 준비 정보 (선택 · 나중에 확인)"}</summary>
            {isFormFieldEnabled('groomFamilyMembers') && (<div className="pt-3">
              <label htmlFor="groom-family" className="block text-xs sm:text-sm font-semibold text-[rgb(var(--studio-primary))] mb-2">{getFormField('groomFamilyMembers').label} <FieldRequirement field="groomFamilyMembers" /></label>
              <input
                required={isFormFieldRequired('groomFamilyMembers')}
                aria-required={isFormFieldRequired('groomFamilyMembers')}
                aria-invalid={!!errors.groomFamilyMembers}
                id="groom-family"
                maxLength={300}
                type="text"
                placeholder={getFormField('groomFamilyMembers').placeholder}
                value={groomFamilyMembers}
                onChange={(e) => onChange({ groomFamilyMembers: e.target.value })}
                className={`w-full h-12 px-3.5 bg-[#FFFFFF] border ${
                  errors.groomFamilyMembers ? 'border-red-400 focus:ring-red-400' : 'border-[rgb(var(--studio-line))] focus:border-[rgb(var(--studio-primary))]'
                } rounded-xl text-sm sm:text-base text-[rgb(var(--studio-primary))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--studio-primary))]/10 transition-all placeholder:text-[rgb(var(--studio-muted))]/70 font-medium`}
              />
              <p className="text-xs sm:text-sm text-[rgb(var(--studio-muted))] mt-2 break-keep leading-relaxed">
                {isFormFieldRequired('groomFamilyMembers') || isFormFieldRequired('brideFamilyMembers') ? '필수 표시된 가족사진 준비 정보를 입력해 주세요.' : '가족사진 촬영 준비를 위한 선택 정보입니다. 계약 후 촬영 준비 단계에서 확인해도 됩니다.'}
              </p>
              {errors.groomFamilyMembers && (
                <p className="text-xs text-red-500 mt-1.5 font-medium">{errors.groomFamilyMembers}</p>
              )}
            </div>)}
          </details>)}
        </div>
      </div>

      {/* 신부 정보 */}
      <div className="p-4 sm:p-5 bg-[rgb(var(--studio-background))] border border-[rgb(var(--studio-border))] rounded-2xl space-y-4">
        <span className="text-xs sm:text-sm font-bold text-[rgb(var(--studio-muted))] tracking-wider uppercase flex items-center gap-1.5">
          <User className="w-4 h-4 text-[rgb(var(--studio-muted))]" />
          <span>신부님 정보</span>
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs sm:text-sm font-semibold text-[rgb(var(--studio-primary))] mb-2">
              신부 성명 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              placeholder="예: 이서연"
              value={brideName}
              onChange={(e) => onChange({ brideName: e.target.value })}
              className={`w-full h-12 px-3.5 bg-[#FFFFFF] border ${
                errors.brideName ? 'border-red-400 focus:ring-red-400' : 'border-[rgb(var(--studio-line))] focus:border-[rgb(var(--studio-primary))]'
              } rounded-xl text-sm sm:text-base text-[rgb(var(--studio-primary))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--studio-primary))]/10 transition-all placeholder:text-[rgb(var(--studio-muted))]/70 font-medium`}
            />
            {errors.brideName && (
              <p className="text-xs text-red-500 mt-1.5 font-medium">{errors.brideName}</p>
            )}
          </div>

          {isFormFieldEnabled('bridePhone') && (<div>
            <label htmlFor="contract-field-bridePhone" className="block text-xs sm:text-sm font-semibold text-[rgb(var(--studio-primary))] mb-2">{getFormField('bridePhone').label} <FieldRequirement field="bridePhone" /></label>
            <input
              id="contract-field-bridePhone"
              required={isFormFieldRequired('bridePhone')}
              aria-required={isFormFieldRequired('bridePhone')}
              aria-invalid={!!errors.bridePhone}
              type="tel"
              placeholder={getFormField('bridePhone').placeholder}
              value={bridePhone}
              onChange={(e) => onChange({ bridePhone: e.target.value })}
              className={`w-full h-12 px-3.5 bg-[#FFFFFF] border ${
                errors.bridePhone ? 'border-red-400 focus:ring-red-400' : 'border-[rgb(var(--studio-line))] focus:border-[rgb(var(--studio-primary))]'
              } rounded-xl text-sm sm:text-base text-[rgb(var(--studio-primary))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--studio-primary))]/10 transition-all placeholder:text-[rgb(var(--studio-muted))]/70 font-medium`}
            />
            {errors.bridePhone && (
              <p className="text-xs text-red-500 mt-1.5 font-medium">{errors.bridePhone}</p>
            )}
          </div>)}

          {/* 신부님 직계 가족구성 */}
          {(isFormFieldEnabled('brideFamilyMembers')) && (<details
            open={(isFormFieldRequired('brideFamilyMembers') || !!(errors.brideFamilyMembers)) || undefined}
            onToggle={(event) => {
              if ((isFormFieldRequired('brideFamilyMembers') || !!(errors.brideFamilyMembers)) && !event.currentTarget.open) {
                event.currentTarget.open = true;
              }
            }}
            className="sm:col-span-2 rounded-xl border border-[rgb(var(--studio-border))] p-3"
          >
            <summary className="cursor-pointer text-sm font-semibold text-[rgb(var(--studio-body))]">{(isFormFieldRequired('brideFamilyMembers')) ? "신부 가족사진 준비 정보 (필수 항목 포함)" : "신부 가족사진 준비 정보 (선택 · 나중에 확인)"}</summary>
            {isFormFieldEnabled('brideFamilyMembers') && (<div className="pt-3">
              <label htmlFor="bride-family" className="block text-xs sm:text-sm font-semibold text-[rgb(var(--studio-primary))] mb-2">{getFormField('brideFamilyMembers').label} <FieldRequirement field="brideFamilyMembers" /></label>
              <input
                required={isFormFieldRequired('brideFamilyMembers')}
                aria-required={isFormFieldRequired('brideFamilyMembers')}
                aria-invalid={!!errors.brideFamilyMembers}
                id="bride-family"
                maxLength={300}
                type="text"
                placeholder={getFormField('brideFamilyMembers').placeholder}
                value={brideFamilyMembers}
                onChange={(e) => onChange({ brideFamilyMembers: e.target.value })}
                className={`w-full h-12 px-3.5 bg-[#FFFFFF] border ${
                  errors.brideFamilyMembers ? 'border-red-400 focus:ring-red-400' : 'border-[rgb(var(--studio-line))] focus:border-[rgb(var(--studio-primary))]'
                } rounded-xl text-sm sm:text-base text-[rgb(var(--studio-primary))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--studio-primary))]/10 transition-all placeholder:text-[rgb(var(--studio-muted))]/70 font-medium`}
              />
              <p className="text-xs sm:text-sm text-[rgb(var(--studio-muted))] mt-2 break-keep leading-relaxed">
                {isFormFieldRequired('groomFamilyMembers') || isFormFieldRequired('brideFamilyMembers') ? '필수 표시된 가족사진 준비 정보를 입력해 주세요.' : '가족사진 촬영 준비를 위한 선택 정보입니다. 계약 후 촬영 준비 단계에서 확인해도 됩니다.'}
              </p>
              {errors.brideFamilyMembers && (
                <p className="text-xs text-red-500 mt-1.5 font-medium">{errors.brideFamilyMembers}</p>
              )}
            </div>)}
          </details>)}
        </div>
      </div>

      {/* 수신 이메일 */}
      <div>
        <label className="block text-xs sm:text-sm font-semibold text-[rgb(var(--studio-primary))] mb-2">
          계약서 수신 이메일 <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <input
            type="email"
            placeholder="example@naver.com"
            value={email}
            onChange={(e) => onChange({ email: e.target.value })}
            className={`w-full h-12 px-3.5 bg-[#FFFFFF] border ${
              errors.email ? 'border-red-400 focus:ring-red-400' : 'border-[rgb(var(--studio-line))] focus:border-[rgb(var(--studio-primary))]'
            } rounded-xl text-sm sm:text-base text-[rgb(var(--studio-primary))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--studio-primary))]/10 transition-all placeholder:text-[rgb(var(--studio-muted))]/70 font-medium`}
          />
        </div>
        <p className="text-xs sm:text-sm text-[rgb(var(--studio-muted))] mt-2 break-keep leading-relaxed">
          * 작성하신 이메일로 최종 전자 계약서(PDF)가 <span className="whitespace-nowrap">발송됩니다.</span>
        </p>
        {errors.email && (
          <p className="text-xs text-red-500 mt-1.5 font-medium">{errors.email}</p>
        )}
      </div>
    </div>
  );
};
