import { StyleSheet, Text, View } from 'react-native';

import { getExpiryPresentation } from '@/utils/expiry-date';

type ExpiryBadgeProps = {
  expiryDate: string;
};

export function ExpiryBadge({ expiryDate }: ExpiryBadgeProps) {
  const presentation = getExpiryPresentation(expiryDate);

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: presentation.background,
        },
      ]}
    >
      <Text
        style={[
          styles.label,
          {
            color: presentation.foreground,
          },
        ]}
      >
        {presentation.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
  },
});